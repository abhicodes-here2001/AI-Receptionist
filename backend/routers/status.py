"""Status endpoint — check if onboarding is complete."""

from fastapi import APIRouter

from backend.storage import storage

router = APIRouter()


@router.get("/status")
async def get_status():
    if storage.owner and storage.owner.onboarding_complete:
        return {
            "onboarding_complete": True,
            "owner_name": storage.owner.name,
            "contact_count": len(storage.contacts),
            "default_language": storage.owner.default_language,
        }
    return {"onboarding_complete": False, "owner_name": None, "contact_count": 0, "default_language": None}


@router.post("/reset")
async def reset():
    """Clear all data for a fresh onboarding."""
    storage.reset()
    return {"status": "reset"}
