"""Call log endpoints and owner actions."""

from __future__ import annotations

from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

from backend.models import Contact
from backend.storage import storage
from backend.dashboard_broadcaster import broadcaster

router = APIRouter()


@router.get("/calls")
async def list_calls():
    return [log.model_dump() for log in storage.get_call_logs_sorted()]


class FlagSpamPayload(BaseModel):
    phone_number: str


@router.post("/calls/flag-spam")
async def flag_spam(payload: FlagSpamPayload):
    storage.flag_scammer(payload.phone_number)
    return {"success": True}


class VerifyTypePayload(BaseModel):
    call_id: int
    verified_type: str


@router.post("/calls/verify-type")
async def verify_type(payload: VerifyTypePayload):
    log = storage.update_call_log(payload.call_id, owner_verified_type=payload.verified_type)
    if not log:
        raise HTTPException(status_code=404, detail="Call not found")
    await broadcaster.broadcast_call_update(log)
    return log.model_dump()


class AddContactFromCallPayload(BaseModel):
    call_id: int
    name: str
    relationship: str
    priority: str = "medium"


@router.post("/calls/add-contact")
async def add_contact_from_call(payload: AddContactFromCallPayload):
    log = storage.get_call_log(payload.call_id)
    if not log:
        raise HTTPException(status_code=404, detail="Call not found")
    contact = storage.add_contact(Contact(
        name=payload.name,
        relationship=payload.relationship,
        phone_number=log.phone_number,
        priority=payload.priority,
    ))
    return contact.model_dump()
