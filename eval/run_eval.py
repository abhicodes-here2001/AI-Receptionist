"""Run evaluation scenarios against the AI receptionist prompts.

Uses GPT-4o in text mode (not voice) to simulate conversations.
The caller follows a scripted set of lines; the AI uses our actual prompts.
Outputs transcripts to eval/results/, then judges them automatically.

Usage:
    python -m eval.run_eval                    # run all scenarios + judge
    python -m eval.run_eval --scenario mom_saved_high  # run one + judge
    python -m eval.run_eval --list             # list scenarios
    python -m eval.run_eval --no-judge         # run without judging
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

# Add project root to path so we can import backend modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.models import Contact, OwnerProfile
from backend.prompts import (
    bypass_prompt,
    get_prompt,
    get_tools_for_call,
    map_caller_type_to_prompt_key,
    personal_prompt,
)
from backend.screening import screen_call
from backend.storage import storage

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

SCENARIOS_PATH = Path(__file__).parent / "scenarios.json"
RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)

# Default owner profile for eval
EVAL_OWNER = OwnerProfile(
    name="Abhisar",
    default_language="english",
    delivery_instructions="Leave at the front door near the gate. If gate is locked, call again.",
    call_preferences={"insurance": "decline", "loans": "decline", "recruiters": "accept"},
    custom_rules=[],
    onboarding_complete=True,
)

MAX_TURNS = 12


def load_scenarios() -> list[dict]:
    return json.loads(SCENARIOS_PATH.read_text())


def setup_scenario(scenario: dict) -> None:
    """Set up storage state for a scenario (contacts, owner)."""
    storage.owner = EVAL_OWNER

    # Clear existing contacts
    for c in list(storage.contacts):
        storage.remove_contact(c.id)

    # Add scenario contact if specified
    if "setup_contact" in scenario:
        sc = scenario["setup_contact"]
        storage.add_contact(Contact(
            name=sc["name"],
            phone_number=sc["phone_number"],
            relationship=sc.get("relationship", ""),
            priority=sc.get("priority", "medium"),
        ))


def get_initial_prompt_and_context(scenario: dict) -> tuple[str, str, bool]:
    """Determine the initial prompt based on screening. Returns (prompt, prompt_key, is_bypass)."""
    phone = scenario.get("caller_phone", "")
    result = screen_call(phone)

    if result.action == "auto_block":
        return "", "blocked", False

    if result.action == "bypass" and result.contact:
        prompt = bypass_prompt(EVAL_OWNER, result.contact.name)
        return prompt, "bypass", True

    if result.contact and result.prompt_key == "personal":
        prompt = personal_prompt(
            EVAL_OWNER,
            contact_name=result.contact.name,
            contact_relationship=result.contact.relationship or "",
            contact_priority=result.contact.priority,
        )
        return prompt, "personal", False

    prompt = get_prompt(result.prompt_key, EVAL_OWNER)
    return prompt, result.prompt_key, False


def simulate_conversation(client: OpenAI, scenario: dict) -> dict:
    """Simulate a conversation for one scenario."""
    setup_scenario(scenario)

    initial_prompt, prompt_key, is_bypass = get_initial_prompt_and_context(scenario)

    if prompt_key == "blocked":
        return {
            "scenario_id": scenario["id"],
            "scenario_name": scenario["name"],
            "transcript": [{"role": "system", "text": "Call auto-blocked (known scammer)"}],
            "prompt_switches": [],
            "classify_calls": [],
            "action": "auto_blocked",
        }

    tools = get_tools_for_call()

    # Build tool definitions for OpenAI chat API format
    openai_tools = []
    for t in tools:
        openai_tools.append({
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["parameters"],
            },
        })

    messages = [{"role": "system", "content": initial_prompt}]
    transcript = []
    classify_calls = []
    prompt_switches = [prompt_key]
    current_prompt_key = prompt_key

    # AI speaks first (greeting)
    logger.info("  [AI greeting...]")
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        tools=openai_tools if openai_tools else None,
        tool_choice="auto",
    )

    ai_msg = response.choices[0].message

    # Process initial response (may include tool calls)
    ai_text, classify_calls, prompt_switches, current_prompt_key, messages = _process_ai_response(
        client, ai_msg, messages, openai_tools, classify_calls, prompt_switches, current_prompt_key
    )

    if ai_text:
        transcript.append({"role": "ai", "text": ai_text})
        logger.info("  AI: %s", ai_text[:100])

    # Caller turns
    caller_script = scenario.get("caller_script", [])
    for i, caller_line in enumerate(caller_script):
        if len(transcript) > MAX_TURNS:
            break

        transcript.append({"role": "caller", "text": caller_line})
        logger.info("  Caller: %s", caller_line[:100])

        messages.append({"role": "user", "content": caller_line})

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=openai_tools if openai_tools else None,
            tool_choice="auto",
        )

        ai_msg = response.choices[0].message
        ai_text, classify_calls, prompt_switches, current_prompt_key, messages = _process_ai_response(
            client, ai_msg, messages, openai_tools, classify_calls, prompt_switches, current_prompt_key
        )

        if ai_text:
            transcript.append({"role": "ai", "text": ai_text})
            logger.info("  AI: %s", ai_text[:100])

    return {
        "scenario_id": scenario["id"],
        "scenario_name": scenario["name"],
        "transcript": transcript,
        "prompt_switches": prompt_switches,
        "classify_calls": classify_calls,
        "is_bypass": is_bypass,
        "expected": scenario.get("expected", {}),
    }


def _process_ai_response(
    client: OpenAI,
    ai_msg,
    messages: list,
    openai_tools: list,
    classify_calls: list,
    prompt_switches: list,
    current_prompt_key: str,
    depth: int = 0,
) -> tuple[str, list, list, str, list]:
    """Process an AI response, handling tool calls recursively."""
    if depth > 5:
        return ai_msg.content or "", classify_calls, prompt_switches, current_prompt_key, messages

    if ai_msg.tool_calls:
        messages.append(ai_msg)

        for tool_call in ai_msg.tool_calls:
            fn_name = tool_call.function.name
            try:
                fn_args = json.loads(tool_call.function.arguments)
            except json.JSONDecodeError:
                fn_args = {}

            if fn_name == "classify_caller":
                classify_calls.append(fn_args)
                caller_type = fn_args.get("caller_type", "")
                is_scammer = fn_args.get("is_scammer", False)
                new_key = map_caller_type_to_prompt_key(caller_type, is_scammer)

                if new_key != current_prompt_key:
                    current_prompt_key = new_key
                    prompt_switches.append(new_key)
                    new_prompt = get_prompt(new_key, EVAL_OWNER)
                    messages[0] = {"role": "system", "content": new_prompt}

                result = json.dumps({"status": "classified", "type": caller_type})
            else:
                result = json.dumps({"status": "ok"})

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })

        # Get the AI's follow-up after tool calls
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=openai_tools if openai_tools else None,
            tool_choice="auto",
        )
        return _process_ai_response(
            client, response.choices[0].message, messages, openai_tools,
            classify_calls, prompt_switches, current_prompt_key, depth + 1
        )

    # No tool calls — just text
    text = ai_msg.content or ""
    messages.append({"role": "assistant", "content": text})
    return text, classify_calls, prompt_switches, current_prompt_key, messages


def main():
    parser = argparse.ArgumentParser(description="Run AI Receptionist evaluation scenarios")
    parser.add_argument("--scenario", type=str, help="Run a specific scenario by ID")
    parser.add_argument("--list", action="store_true", help="List all scenarios")
    parser.add_argument("--no-judge", action="store_true", help="Skip auto-judging after simulation")
    args = parser.parse_args()

    scenarios = load_scenarios()

    if args.list:
        for s in scenarios:
            print(f"  {s['id']:30s} — {s['name']}")
        return

    if args.scenario:
        scenarios = [s for s in scenarios if s["id"] == args.scenario]
        if not scenarios:
            print(f"Scenario '{args.scenario}' not found.")
            return

    client = OpenAI()
    all_results = []

    logger.info("=" * 60)
    logger.info("AI Receptionist Evaluation — %d scenarios", len(scenarios))
    logger.info("=" * 60)

    for scenario in scenarios:
        logger.info("\n--- %s ---", scenario["name"])
        try:
            result = simulate_conversation(client, scenario)
            all_results.append(result)
        except Exception as e:
            logger.error("  ERROR: %s", e)
            all_results.append({
                "scenario_id": scenario["id"],
                "scenario_name": scenario["name"],
                "error": str(e),
            })

    # Save results
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    output_path = RESULTS_DIR / f"eval_{timestamp}.json"
    output_path.write_text(json.dumps(all_results, indent=2, ensure_ascii=False))
    logger.info("\n" + "=" * 60)
    logger.info("Results saved to: %s", output_path)

    # Auto-judge unless --no-judge
    if not args.no_judge:
        logger.info("\n" + "=" * 60)
        logger.info("Judging transcripts...")
        logger.info("=" * 60)

        from eval.judge import judge_transcript, print_report

        judged = []
        for result in all_results:
            logger.info("  Scoring: %s", result.get("scenario_name", result.get("scenario_id")))
            scored = judge_transcript(client, result)
            judged.append(scored)

        print_report(judged)

        judged_path = output_path.with_name(output_path.stem + "_judged.json")
        judged_path.write_text(json.dumps(judged, indent=2, ensure_ascii=False))
        logger.info("\nJudged results saved to: %s", judged_path)
    else:
        logger.info("Judge manually: python -m eval.judge %s", output_path)


if __name__ == "__main__":
    main()
