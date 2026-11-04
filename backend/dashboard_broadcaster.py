"""Broadcast call updates to connected dashboard WebSocket clients."""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from backend.models import CallLog
from backend.storage import storage

logger = logging.getLogger(__name__)


class DashboardBroadcaster:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._clients.add(websocket)
        logs = [log.model_dump() for log in storage.get_call_logs_sorted()]
        await websocket.send_json({"type": "full_sync", "calls": logs})

    def disconnect(self, websocket: WebSocket) -> None:
        self._clients.discard(websocket)

    async def broadcast_new_call(self, call: CallLog) -> None:
        await self._broadcast({"type": "new_call", "call": call.model_dump()})

    async def broadcast_call_update(self, call: CallLog) -> None:
        await self._broadcast({"type": "call_updated", "call": call.model_dump()})

    async def _broadcast(self, message: dict[str, Any]) -> None:
        payload = json.dumps(message, default=str)
        dead: list[WebSocket] = []
        for client in self._clients:
            try:
                await client.send_text(payload)
            except Exception:
                dead.append(client)
        for client in dead:
            self._clients.discard(client)


broadcaster = DashboardBroadcaster()


async def dashboard_websocket(websocket: WebSocket) -> None:
    """Handle a dashboard WebSocket connection."""
    await broadcaster.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            # Owner actions will be handled here in Step 6
            logger.info("Dashboard action: %s", data.get("type"))
    except WebSocketDisconnect:
        broadcaster.disconnect(websocket)
