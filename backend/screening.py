"""Call screening logic — stub for Step 5."""

from __future__ import annotations

from backend.models import ScreeningResult
from backend.storage import storage


def screen_call(phone_number: str) -> ScreeningResult:
    """Screen an incoming call. Full implementation in Step 5."""
    if storage.is_scammer(phone_number):
        return ScreeningResult(
            action="auto_block",
            reason="Previously flagged scammer",
            prompt_key="scammer",
        )

    contact = storage.find_contact_by_phone(phone_number)
    if contact:
        action_map = {"high": "bypass", "medium": "urgent_notify", "low": "normal_screen"}
        return ScreeningResult(
            action=action_map.get(contact.priority, "normal_screen"),
            reason=f"Known contact: {contact.name} ({contact.relationship})",
            prompt_key="personal",
            contact=contact,
        )

    if storage.is_session_active(phone_number):
        session = storage.get_or_create_session(phone_number)
        return ScreeningResult(
            action="normal_screen",
            reason=f"Returning caller (type: {session.caller_type})",
            prompt_key=session.current_prompt_key or "greeting",
            session=session,
        )

    return ScreeningResult(
        action="normal_screen",
        reason="Unknown caller",
        prompt_key="greeting",
    )
