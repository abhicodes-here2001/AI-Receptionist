"""Pydantic models for the AI Receptionist."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class OwnerProfile(BaseModel):
    name: str
    default_language: str = "english"
    delivery_instructions: str = ""
    call_preferences: dict[str, str] = {}
    custom_rules: list[str] = []
    onboarding_complete: bool = False


class Contact(BaseModel):
    id: int = 0
    name: str
    relationship: str
    phone_number: str
    priority: Literal["high", "medium", "low"]


class ConversationTurn(BaseModel):
    role: Literal["caller", "ai"]
    text: str
    timestamp: float


class CallLog(BaseModel):
    call_id: int
    phone_number: str
    caller_name: str | None = None
    message: str = ""
    conversation_history: list[dict] = []
    type: str = "unknown"
    priority: Literal["high", "medium", "low"] = "low"
    language_states: list[str] = []
    timestamp: float = 0.0
    action_taken: str = ""
    owner_verified_type: str | None = None


class ConversationSession(BaseModel):
    id: str
    phone_number: str
    history: list[ConversationTurn] = []
    last_activity: float
    caller_type: str = ""
    caller_name: str | None = None
    current_prompt_key: str = "greeting"
    language_states: list[str] = []
    expires_at: float


class ScreeningResult(BaseModel):
    action: Literal["auto_block", "bypass", "urgent_notify", "normal_screen"]
    reason: str = ""
    prompt_key: str = "greeting"
    contact: Contact | None = None
    session: ConversationSession | None = None
