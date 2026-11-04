"""WebSocket relay between browser and OpenAI Realtime API.

Voice pipeline: Browser ↔ FastAPI (/ws/voice) ↔ OpenAI Realtime API.
The server intercepts events for prompt swapping, call logging, and type detection.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field

import websockets
from fastapi import WebSocket, WebSocketDisconnect

from backend.dashboard_broadcaster import broadcaster
from backend.models import Contact, ConversationTurn, OwnerProfile
from backend.prompts import (
    bypass_prompt,
    get_onboarding_prompt,
    get_prompt,
    get_tools_for_call,
    get_tools_for_onboarding,
    map_caller_type_to_prompt_key,
    personal_prompt,
)
from backend.screening import screen_call
from backend.storage import storage

logger = logging.getLogger(__name__)

OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1"
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")


@dataclass
class CallState:
    """Mutable state for an active call."""

    phone_number: str = ""
    mode: str = "call"  # "call" or "onboarding"
    onboarding_phase: int = 0
    current_prompt_key: str = "greeting"
    is_bypass: bool = False
    is_saved_contact: bool = False
    contact_relationship: str = ""
    contact_priority: str = ""
    caller_type: str = ""
    caller_name: str | None = None
    priority: str = "low"
    language_states: list[str] = field(default_factory=list)
    conversation_history: list[ConversationTurn] = field(default_factory=list)
    ai_transcript_buffer: str = ""
    caller_transcript_buffer: str = ""
    call_id: int | None = None
    is_scammer: bool = False
    function_call_name: str = ""
    function_call_args: str = ""
    function_call_id: str = ""


async def voice_websocket(browser_ws: WebSocket) -> None:
    """Main WebSocket handler for voice connections from the browser."""
    await browser_ws.accept()

    try:
        initial_data = await browser_ws.receive_json()
    except WebSocketDisconnect:
        return

    state = CallState()
    state.mode = initial_data.get("type", "start_call").replace("start_", "")
    state.phone_number = initial_data.get("phone_number", "")
    state.onboarding_phase = initial_data.get("phase", 0)

    owner = storage.owner

    # --- Pre-call screening (call mode only) ---
    if state.mode == "call" and state.phone_number:
        result = screen_call(state.phone_number)
        if result.action == "auto_block":
            await browser_ws.send_json({
                "type": "blocked",
                "reason": result.reason,
            })
            log = storage.add_call_log(
                phone_number=state.phone_number,
                type="scammer",
                priority="low",
                action_taken="auto_blocked",
                timestamp=time.time(),
            )
            await broadcaster.broadcast_new_call(log)
            await browser_ws.close()
            return

        state.current_prompt_key = result.prompt_key
        if result.contact:
            state.caller_name = result.contact.name
            state.priority = result.contact.priority
            state.is_saved_contact = True
            state.contact_relationship = result.contact.relationship or ""
            state.contact_priority = result.contact.priority

        if result.action == "bypass":
            state.is_bypass = True
            await browser_ws.send_json({
                "type": "status",
                "status": "bypass",
                "message": f"High priority contact: {result.contact.name if result.contact else 'unknown'}",
            })

        # Create or resume session
        session = storage.get_or_create_session(state.phone_number)
        if result.session and result.session.history:
            state.conversation_history = list(result.session.history)
            state.caller_type = result.session.caller_type
            state.language_states = list(result.session.language_states)

        # Create call log entry
        log = storage.add_call_log(
            phone_number=state.phone_number,
            caller_name=state.caller_name,
            type=state.caller_type or ("contact" if state.is_bypass else "screening"),
            priority=state.priority,
            action_taken="bypassed" if state.is_bypass else "screening",
            timestamp=time.time(),
            language_states=state.language_states,
        )
        state.call_id = log.call_id
        await broadcaster.broadcast_new_call(log)

    # --- Determine initial prompt and tools ---
    if state.mode == "onboarding":
        prompt = get_onboarding_prompt(state.onboarding_phase, owner)
        tools = get_tools_for_onboarding(state.onboarding_phase)
    elif state.is_bypass and owner:
        prompt = bypass_prompt(owner, state.caller_name or "")
        tools = get_tools_for_call()
    elif state.is_saved_contact and state.current_prompt_key == "personal" and owner:
        prompt = personal_prompt(
            owner,
            contact_name=state.caller_name or "",
            contact_relationship=state.contact_relationship,
            contact_priority=state.contact_priority,
        )
        tools = get_tools_for_call()
    else:
        prompt = get_prompt(state.current_prompt_key, owner)
        tools = get_tools_for_call()

        # For returning callers, prepend conversation context
        if state.conversation_history:
            context = "\n\nPREVIOUS CONVERSATION CONTEXT (this is a returning caller):\n"
            for turn in state.conversation_history[-10:]:
                context += f"{'Caller' if turn.role == 'caller' else 'AI'}: {turn.text}\n"
            prompt = prompt + context

    # --- Connect to OpenAI Realtime API ---
    if not OPENAI_API_KEY:
        await browser_ws.send_json({"type": "error", "message": "OPENAI_API_KEY not configured"})
        await browser_ws.close()
        return

    try:
        openai_ws = await websockets.connect(
            OPENAI_REALTIME_URL,
            additional_headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
            },
        )
    except Exception as e:
        logger.error("Failed to connect to OpenAI: %s", e)
        await browser_ws.send_json({"type": "error", "message": f"Failed to connect to OpenAI: {e}"})
        await browser_ws.close()
        return

    # --- Send session configuration ---
    session_config = {
        "type": "session.update",
        "session": {
            "type": "realtime",
            "instructions": prompt,
            "output_modalities": ["audio"],
            "audio": {
                "input": {
                    "format": {"type": "audio/pcm", "rate": 24000},
                    "transcription": {"model": "whisper-1"},
                    "turn_detection": {
                        "type": "server_vad",
                        "threshold": 0.7,
                        "prefix_padding_ms": 300,
                        "silence_duration_ms": 800,
                    },
                },
                "output": {
                    "format": {"type": "audio/pcm", "rate": 24000},
                    "voice": "shimmer",
                },
            },
            "tools": tools,
            "tool_choice": "auto",
        },
    }
    await openai_ws.send(json.dumps(session_config))

    # Trigger the AI to speak first (greet the caller / start onboarding)
    await openai_ws.send(json.dumps({"type": "response.create"}))

    await browser_ws.send_json({"type": "status", "status": "connected"})

    # --- Run bidirectional relay ---
    try:
        await asyncio.gather(
            _relay_browser_to_openai(browser_ws, openai_ws, state),
            _relay_openai_to_browser(browser_ws, openai_ws, state),
        )
    except Exception as e:
        logger.info("Voice session ended: %s", e)
    finally:
        await _finalize_call(state)
        try:
            await openai_ws.close()
        except Exception:
            pass


async def _relay_browser_to_openai(
    browser_ws: WebSocket,
    openai_ws: websockets.WebSocketClientProtocol,
    state: CallState,
) -> None:
    """Forward audio from browser to OpenAI."""
    try:
        while True:
            data = await browser_ws.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "audio_data":
                await openai_ws.send(json.dumps({
                    "type": "input_audio_buffer.append",
                    "audio": data["audio"],
                }))

            elif msg_type == "contacts_complete":
                count = data.get("count", 0)
                await openai_ws.send(json.dumps({
                    "type": "conversation.item.create",
                    "item": {
                        "type": "message",
                        "role": "user",
                        "content": [{
                            "type": "input_text",
                            "text": f"[SYSTEM: The user has finished adding {count} contact(s) through the form. Move on to Step 3 — ask about their delivery instructions and call preferences now.]",
                        }],
                    },
                }))
                await openai_ws.send(json.dumps({"type": "response.create"}))
                logger.info("Contacts complete signal sent to AI (%d contacts)", count)

            elif msg_type == "end_call":
                logger.info("Call ended by user")
                raise WebSocketDisconnect()

    except (WebSocketDisconnect, Exception):
        raise


async def _relay_openai_to_browser(
    browser_ws: WebSocket,
    openai_ws: websockets.WebSocketClientProtocol,
    state: CallState,
) -> None:
    """Forward audio from OpenAI to browser, intercepting events for logic."""
    try:
        async for raw_message in openai_ws:
            event = json.loads(raw_message)
            event_type = event.get("type", "")

            if event_type == "response.output_audio.delta":
                await browser_ws.send_json({
                    "type": "audio_data",
                    "audio": event.get("delta", ""),
                })

            elif event_type == "response.output_audio_transcript.delta":
                state.ai_transcript_buffer += event.get("delta", "")

            elif event_type == "response.output_audio_transcript.done":
                transcript = event.get("transcript", state.ai_transcript_buffer)
                if transcript:
                    state.conversation_history.append(
                        ConversationTurn(role="ai", text=transcript, timestamp=time.time())
                    )
                    await browser_ws.send_json({
                        "type": "transcript",
                        "role": "ai",
                        "text": transcript,
                    })
                state.ai_transcript_buffer = ""

            elif event_type == "input_audio_buffer.speech_started":
                await browser_ws.send_json({"type": "speech_started"})

            elif event_type == "response.output_audio.done":
                await browser_ws.send_json({"type": "audio_done"})

            elif event_type == "conversation.item.input_audio_transcription.completed":
                transcript = event.get("transcript", "")
                if transcript:
                    state.conversation_history.append(
                        ConversationTurn(role="caller", text=transcript, timestamp=time.time())
                    )
                    await browser_ws.send_json({
                        "type": "transcript",
                        "role": "caller",
                        "text": transcript,
                    })

            elif event_type == "response.function_call_arguments.delta":
                state.function_call_args += event.get("delta", "")

            elif event_type == "response.function_call_arguments.done":
                call_id = event.get("call_id", "")
                name = event.get("name", state.function_call_name)
                args_str = event.get("arguments", state.function_call_args)
                state.function_call_name = ""
                state.function_call_args = ""

                try:
                    args = json.loads(args_str)
                except json.JSONDecodeError:
                    args = {}

                await _handle_function_call(browser_ws, openai_ws, state, name, args, call_id)

            elif event_type == "response.output_item.added":
                item = event.get("item", {})
                if item.get("type") == "function_call":
                    state.function_call_name = item.get("name", "")
                    state.function_call_args = ""
                    state.function_call_id = item.get("call_id", "")

            elif event_type == "response.done":
                _update_session(state)

            elif event_type == "error":
                error_msg = event.get("error", {}).get("message", "Unknown error")
                logger.error("OpenAI error: %s", error_msg)
                await browser_ws.send_json({"type": "error", "message": error_msg})

            elif event_type == "session.updated":
                logger.info("Session updated successfully")

    except websockets.ConnectionClosed:
        logger.info("OpenAI WebSocket closed")
        raise


async def _handle_function_call(
    browser_ws: WebSocket,
    openai_ws: websockets.WebSocketClientProtocol,
    state: CallState,
    name: str,
    args: dict,
    call_id: str,
) -> None:
    """Handle a function call from the model."""
    logger.info("Function call: %s(%s)", name, json.dumps(args)[:200])
    owner = storage.owner

    if name == "classify_caller":
        caller_type = args.get("caller_type", "")
        caller_name = args.get("caller_name")
        priority = args.get("priority", "low")
        language = args.get("language", "")
        is_scammer = args.get("is_scammer", False)

        state.caller_type = caller_type
        state.is_scammer = is_scammer
        if caller_name:
            state.caller_name = caller_name
        state.priority = priority
        if language and (not state.language_states or state.language_states[-1] != language):
            state.language_states.append(language)

        # Check if owner's call_preferences say to bypass this type
        pref_bypass = False
        if owner and owner.call_preferences and not state.is_bypass:
            ct_lower = caller_type.lower()
            for pref_type, pref_action in owner.call_preferences.items():
                if pref_type.lower() in ct_lower or ct_lower in pref_type.lower():
                    if pref_action.lower() in ("accept", "bypass", "pass", "connect"):
                        pref_bypass = True
                        break

        # Mid-call bypass: saved contact escalated OR preference says bypass
        if not state.is_bypass and owner and (
            (state.is_saved_contact and priority == "high")
            or pref_bypass
        ):
            state.is_bypass = True
            state.priority = "high"
            new_prompt = bypass_prompt(owner, state.caller_name or caller_type)
            await openai_ws.send(json.dumps({
                "type": "session.update",
                "session": {"type": "realtime", "instructions": new_prompt},
            }))
            reason = state.caller_name or caller_type
            await browser_ws.send_json({
                "type": "status",
                "status": "bypass",
                "message": f"Escalated to bypass: {reason}",
            })
            logger.info("Bypass triggered for: %s (pref_bypass=%s)", reason, pref_bypass)
        else:
            new_prompt_key = map_caller_type_to_prompt_key(caller_type, is_scammer)
            if new_prompt_key != state.current_prompt_key:
                state.current_prompt_key = new_prompt_key
                new_prompt = get_prompt(new_prompt_key, owner)
                await openai_ws.send(json.dumps({
                    "type": "session.update",
                    "session": {"type": "realtime", "instructions": new_prompt},
                }))
                logger.info("Prompt swapped: %s -> %s", state.current_prompt_key, new_prompt_key)

        if is_scammer and state.phone_number:
            storage.flag_scammer(state.phone_number)

        if state.call_id:
            storage.update_call_log(
                state.call_id,
                type=caller_type,
                caller_name=state.caller_name,
                priority=priority,
                language_states=list(state.language_states),
            )
            log = storage.get_call_log(state.call_id)
            if log:
                await broadcaster.broadcast_call_update(log)

        await browser_ws.send_json({
            "type": "caller_info",
            "caller_type": caller_type,
            "caller_name": caller_name,
            "priority": priority,
            "language": language,
            "is_scammer": is_scammer,
        })

        result_text = json.dumps({"status": "classified", "type": caller_type})

    elif name == "save_basics":
        owner_name = args.get("owner_name", "")
        default_language = args.get("default_language", "english")
        storage.owner = OwnerProfile(name=owner_name, default_language=default_language)
        await browser_ws.send_json({
            "type": "onboarding_phase_complete",
            "phase": "basics_saved",
            "data": {"name": owner_name, "language": default_language},
        })
        result_text = json.dumps({"status": "saved", "name": owner_name})

    elif name == "show_contacts_form":
        await browser_ws.send_json({
            "type": "onboarding_phase_complete",
            "phase": "show_contacts",
        })
        result_text = json.dumps({"status": "form_shown"})

    elif name == "add_contact":
        contact_name = args.get("name", "")
        phone = args.get("phone_number", "")
        relationship = args.get("relationship", "")
        priority = args.get("priority", "medium")
        contact = None
        if contact_name and phone:
            contact = storage.add_contact(
                Contact(
                    name=contact_name,
                    phone_number=phone,
                    relationship=relationship or "",
                    priority=priority,
                )
            )
        await browser_ws.send_json({
            "type": "onboarding_phase_complete",
            "phase": "contact_added",
            "data": {
                "name": contact_name,
                "phone_number": phone,
                "relationship": relationship,
                "priority": priority,
            },
        })
        result_text = json.dumps({"status": "added", "name": contact_name})

    elif name == "contacts_done":
        await browser_ws.send_json({
            "type": "onboarding_phase_complete",
            "phase": "contacts_done",
        })
        result_text = json.dumps({"status": "done"})

    elif name == "save_preferences":
        if owner:
            owner.delivery_instructions = args.get("delivery_instructions", "")
            owner.call_preferences = args.get("call_preferences", {})
            owner.custom_rules = args.get("custom_rules", [])
            storage.owner = owner
        await browser_ws.send_json({
            "type": "onboarding_phase_complete",
            "phase": "preferences_saved",
            "data": args,
        })
        result_text = json.dumps({"status": "saved"})

    else:
        result_text = json.dumps({"error": f"Unknown function: {name}"})

    # Send function result back to OpenAI
    await openai_ws.send(json.dumps({
        "type": "conversation.item.create",
        "item": {
            "type": "function_call_output",
            "call_id": call_id,
            "output": result_text,
        },
    }))
    await openai_ws.send(json.dumps({"type": "response.create"}))


def _update_session(state: CallState) -> None:
    """Update the conversation session in storage."""
    if state.mode != "call" or not state.phone_number:
        return

    session = storage.get_or_create_session(state.phone_number)
    session.history = list(state.conversation_history)
    session.caller_type = state.caller_type
    session.caller_name = state.caller_name
    session.current_prompt_key = state.current_prompt_key
    session.language_states = list(state.language_states)
    session.last_activity = time.time()


_FILLER_PATTERNS = {
    "bye", "goodbye", "thank you", "thanks", "ok", "okay", "alright",
    "sure", "hmm", "hello", "hi", "hey", "haan", "theek hai", "shukriya",
    "dhanyavaad", "accha", "bye bye", "take care", "good day",
}


def _is_filler(text: str) -> bool:
    """Check if a message is just a greeting, farewell, or filler."""
    cleaned = text.strip().lower().rstrip(".!?,")
    if len(cleaned) < 5:
        return True
    return cleaned in _FILLER_PATTERNS


def _extract_message(history: list[ConversationTurn]) -> str:
    """Extract the most meaningful caller message, skipping fillers."""
    caller_turns = [t for t in history if t.role == "caller"]
    if not caller_turns:
        return ""

    # Find substantive messages (not greetings/farewells)
    substantive = [t for t in caller_turns if not _is_filler(t.text) and len(t.text) > 10]
    if substantive:
        # Pick the longest substantive message — usually the actual request
        best = max(substantive, key=lambda t: len(t.text))
        return best.text

    # Fallback: combine last few caller messages
    return " ".join(t.text for t in caller_turns[-3:])


async def _finalize_call(state: CallState) -> None:
    """Finalize the call — update logs and session."""
    if state.mode != "call" or not state.call_id:
        return

    message = _extract_message(state.conversation_history)

    action = "took_message"
    if state.is_bypass:
        action = "bypassed"
    elif state.is_scammer:
        action = "blocked"
    elif state.current_prompt_key == "delivery":
        action = "gave_delivery_instructions"

    storage.update_call_log(
        state.call_id,
        message=message[:500],
        conversation_history=[t.model_dump() for t in state.conversation_history],
        type=state.caller_type or "unclear",
        caller_name=state.caller_name,
        priority=state.priority,
        language_states=list(state.language_states),
        action_taken=action,
    )

    _update_session(state)

    log = storage.get_call_log(state.call_id)
    if log:
        await broadcaster.broadcast_call_update(log)

    logger.info(
        "Call %d finalized: type=%s, priority=%s, action=%s",
        state.call_id, state.caller_type, state.priority, action,
    )
