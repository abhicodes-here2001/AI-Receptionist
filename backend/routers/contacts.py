"""Contacts CRUD endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.models import Contact
from backend.storage import storage

router = APIRouter()


@router.get("/contacts")
async def list_contacts():
    return [c.model_dump() for c in storage.contacts]


@router.post("/contacts")
async def add_contact(contact: Contact):
    created = storage.add_contact(contact)
    return created.model_dump()


@router.delete("/contacts/{contact_id}")
async def remove_contact(contact_id: int):
    if not storage.remove_contact(contact_id):
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"success": True}
