"""Onboarding endpoints — save owner profile."""

from __future__ import annotations

from pydantic import BaseModel
from fastapi import APIRouter

from backend.models import OwnerProfile
from backend.storage import storage

router = APIRouter()


class OnboardingPayload(BaseModel):
    name: str
    default_language: str = "english"
    delivery_instructions: str = ""
    call_preferences: dict[str, str] = {}
    custom_rules: list[str] = []


@router.post("/onboarding")
async def save_onboarding(payload: OnboardingPayload):
    storage.owner = OwnerProfile(
        name=payload.name,
        default_language=payload.default_language,
        delivery_instructions=payload.delivery_instructions,
        call_preferences=payload.call_preferences,
        custom_rules=payload.custom_rules,
        onboarding_complete=True,
    )
    return {"success": True, "owner": storage.owner.model_dump()}


@router.get("/onboarding")
async def get_onboarding():
    if storage.owner:
        return storage.owner.model_dump()
    return {"onboarding_complete": False}
