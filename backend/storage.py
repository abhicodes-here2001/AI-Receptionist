"""Persistent file-based storage with in-memory index for fast lookups.

Data lives in a `data/` directory:
  data/
  ├── owner.json           ← owner profile (in memory — read every call)
  ├── contacts.json        ← saved contacts (in memory — checked every call)
  ├── sessions.json        ← active sessions (in memory — checked/updated every turn)
  ├── scammers.json        ← flagged numbers (in memory — checked every call)
  ├── index.json           ← phone→contact_id for O(1) lookups
  └── call_logs/           ← one file per call (on disk only — read on demand)
      ├── 0001.json
      ├── 0002.json
      └── ...

WHAT'S IN MEMORY (small, used on every call, latency-critical):
  - owner profile (~1 object)
  - contacts + phone index (~tens of entries)
  - scammer set (~set of strings)
  - active sessions (~handful of active calls, 2hr TTL)

WHAT'S ON DISK ONLY (large, read on demand):
  - call logs with full conversation transcripts
  - read only when dashboard loads or owner takes action on a call
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import time
import uuid
from pathlib import Path

from backend.models import CallLog, Contact, ConversationSession, OwnerProfile

logger = logging.getLogger(__name__)

SESSION_TTL_SECONDS = 2 * 60 * 60  # 2 hours

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).parent.parent / "data"))


class Storage:
    def __init__(self, data_dir: Path = DATA_DIR) -> None:
        self._data_dir = data_dir
        self._clear_data()
        self._data_dir.mkdir(parents=True, exist_ok=True)
        self._logs_dir = self._data_dir / "call_logs"
        self._logs_dir.mkdir(exist_ok=True)

        # --- IN MEMORY (small, hot data) ---
        self._owner: OwnerProfile | None = None
        self.contacts: list[Contact] = []
        self.sessions: dict[str, ConversationSession] = {}
        self.scammer_numbers: set[str] = set()
        self._phone_index: dict[str, int] = {}  # phone → contact_id

        # --- COUNTERS ---
        self._next_call_id: int = 1
        self._next_contact_id: int = 1

        self._load_hot_data()

    # ------------------------------------------------------------------
    # Fresh start — wipe data directory on every backend restart
    # ------------------------------------------------------------------

    def _clear_data(self) -> None:
        if self._data_dir.exists():
            shutil.rmtree(self._data_dir)
            logger.info("Cleared data directory for fresh onboarding")

    def reset(self) -> None:
        """Public reset — clears all data for a fresh onboarding."""
        self._clear_data()
        self._data_dir.mkdir(parents=True, exist_ok=True)
        self._logs_dir = self._data_dir / "call_logs"
        self._logs_dir.mkdir(exist_ok=True)
        self._owner = None
        self.contacts = []
        self.sessions = {}
        self.scammer_numbers = set()
        self._phone_index = {}
        self._next_call_id = 1
        logger.info("Storage reset complete")

    # ------------------------------------------------------------------
    # Disk I/O helpers
    # ------------------------------------------------------------------

    def _path(self, name: str) -> Path:
        return self._data_dir / name

    def _write_json(self, path: Path, data: object) -> None:
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, default=str, indent=2, ensure_ascii=False))
        tmp.replace(path)

    def _read_json(self, path: Path) -> object:
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("Failed to read %s: %s", path, e)
            return None

    # ------------------------------------------------------------------
    # Startup — load ONLY hot data into memory
    # ------------------------------------------------------------------

    def _load_hot_data(self) -> None:
        """Load small, frequently-accessed data into memory. Call logs stay on disk."""

        # Owner (~1 small object, read every call for prompt building)
        raw = self._read_json(self._path("owner.json"))
        if raw and isinstance(raw, dict):
            self._owner = OwnerProfile(**raw)
            logger.info("Loaded owner: %s", self._owner.name)

        # Contacts (~tens of entries, checked every incoming call)
        raw = self._read_json(self._path("contacts.json"))
        if raw and isinstance(raw, list):
            self.contacts = [Contact(**c) for c in raw]
            self._next_contact_id = max((c.id for c in self.contacts), default=0) + 1
            logger.info("Loaded %d contacts", len(self.contacts))

        # Scammer numbers (~set of strings, checked every incoming call)
        raw = self._read_json(self._path("scammers.json"))
        if raw and isinstance(raw, list):
            self.scammer_numbers = set(raw)
            logger.info("Loaded %d scammer numbers", len(self.scammer_numbers))

        # Active sessions (~handful, checked every call + updated every turn)
        raw = self._read_json(self._path("sessions.json"))
        if raw and isinstance(raw, dict):
            now = time.time()
            for phone, sess_data in raw.items():
                sess = ConversationSession(**sess_data)
                if sess.expires_at > now:
                    self.sessions[phone] = sess
            logger.info("Loaded %d active sessions", len(self.sessions))

        # Call log counter — scan directory for highest ID
        self._next_call_id = self._scan_next_call_id()

        # Build phone index
        self._rebuild_phone_index()
        self._save_index()

    def _scan_next_call_id(self) -> int:
        """Find the next call_id by scanning the call_logs directory."""
        max_id = 0
        for f in self._logs_dir.glob("*.json"):
            try:
                call_id = int(f.stem)
                max_id = max(max_id, call_id)
            except ValueError:
                continue
        return max_id + 1

    # ------------------------------------------------------------------
    # Index (phone → contact_id, O(1) lookups)
    # ------------------------------------------------------------------

    def _rebuild_phone_index(self) -> None:
        self._phone_index.clear()
        for c in self.contacts:
            normalized = self._normalize_phone(c.phone_number)
            self._phone_index[normalized] = c.id
            if len(normalized) >= 10:
                self._phone_index[normalized[-10:]] = c.id

    def _save_index(self) -> None:
        index = {
            "phone_to_contact": self._phone_index,
            "scammer_phones": list(self.scammer_numbers),
            "next_call_id": self._next_call_id,
            "next_contact_id": self._next_contact_id,
        }
        self._write_json(self._path("index.json"), index)

    # ------------------------------------------------------------------
    # Owner (in memory — 1 object, read every call)
    # ------------------------------------------------------------------

    @property
    def owner(self) -> OwnerProfile | None:
        return self._owner

    @owner.setter
    def owner(self, value: OwnerProfile | None) -> None:
        self._owner = value
        if value is not None:
            self._write_json(self._path("owner.json"), value.model_dump())

    # ------------------------------------------------------------------
    # Contacts (in memory — small list, checked every call)
    # ------------------------------------------------------------------

    def add_contact(self, contact: Contact) -> Contact:
        contact.id = self._next_contact_id
        self._next_contact_id += 1
        self.contacts.append(contact)

        normalized = self._normalize_phone(contact.phone_number)
        self._phone_index[normalized] = contact.id
        if len(normalized) >= 10:
            self._phone_index[normalized[-10:]] = contact.id

        self._persist_contacts()
        return contact

    def remove_contact(self, contact_id: int) -> bool:
        for i, c in enumerate(self.contacts):
            if c.id == contact_id:
                self.contacts.pop(i)
                self._rebuild_phone_index()
                self._persist_contacts()
                return True
        return False

    def find_contact_by_phone(self, phone: str) -> Contact | None:
        normalized = self._normalize_phone(phone)
        contact_id = self._phone_index.get(normalized)
        if not contact_id and len(normalized) >= 10:
            contact_id = self._phone_index.get(normalized[-10:])
        if contact_id:
            return next((c for c in self.contacts if c.id == contact_id), None)
        return None

    def _persist_contacts(self) -> None:
        self._write_json(self._path("contacts.json"), [c.model_dump() for c in self.contacts])
        self._save_index()

    # ------------------------------------------------------------------
    # Call Logs (ON DISK ONLY — one file per call, read on demand)
    # ------------------------------------------------------------------

    def _log_path(self, call_id: int) -> Path:
        return self._logs_dir / f"{call_id:04d}.json"

    def add_call_log(self, **kwargs) -> CallLog:
        log = CallLog(call_id=self._next_call_id, **kwargs)
        self._next_call_id += 1
        self._write_json(self._log_path(log.call_id), log.model_dump())
        self._save_index()
        return log

    def update_call_log(self, call_id: int, **updates) -> CallLog | None:
        log = self.get_call_log(call_id)
        if not log:
            return None
        for k, v in updates.items():
            setattr(log, k, v)
        self._write_json(self._log_path(call_id), log.model_dump())
        return log

    def get_call_log(self, call_id: int) -> CallLog | None:
        """Read a single call log from disk."""
        raw = self._read_json(self._log_path(call_id))
        if raw and isinstance(raw, dict):
            return CallLog(**raw)
        return None

    def get_call_logs_sorted(self) -> list[CallLog]:
        """Read ALL call logs from disk (for dashboard). Not called during voice path."""
        logs: list[CallLog] = []
        for f in sorted(self._logs_dir.glob("*.json")):
            raw = self._read_json(f)
            if raw and isinstance(raw, dict):
                logs.append(CallLog(**raw))
        priority_order = {"high": 0, "medium": 1, "low": 2}
        return sorted(
            logs,
            key=lambda c: (priority_order.get(c.priority, 3), -c.timestamp),
        )

    # ------------------------------------------------------------------
    # Sessions (in memory — handful of active calls, 2hr TTL)
    # ------------------------------------------------------------------

    def get_or_create_session(self, phone_number: str) -> ConversationSession:
        existing = self.sessions.get(phone_number)
        if existing and existing.expires_at > time.time():
            existing.last_activity = time.time()
            self._persist_sessions()
            return existing

        session = ConversationSession(
            id=str(uuid.uuid4()),
            phone_number=phone_number,
            last_activity=time.time(),
            expires_at=time.time() + SESSION_TTL_SECONDS,
        )
        self.sessions[phone_number] = session
        self._persist_sessions()
        return session

    def is_session_active(self, phone_number: str) -> bool:
        session = self.sessions.get(phone_number)
        return session is not None and session.expires_at > time.time()

    def clean_expired_sessions(self) -> None:
        now = time.time()
        expired = [p for p, s in self.sessions.items() if s.expires_at <= now]
        for phone in expired:
            del self.sessions[phone]
        if expired:
            self._persist_sessions()
            logger.info("Cleaned %d expired sessions", len(expired))

    def _persist_sessions(self) -> None:
        data = {phone: s.model_dump() for phone, s in self.sessions.items()}
        self._write_json(self._path("sessions.json"), data)

    # ------------------------------------------------------------------
    # Scammer tracking (in memory — set, checked every call)
    # ------------------------------------------------------------------

    @staticmethod
    def _normalize_phone(phone: str) -> str:
        return phone.strip().replace(" ", "").replace("-", "").replace("+", "")

    def flag_scammer(self, phone_number: str) -> None:
        normalized = self._normalize_phone(phone_number)
        self.scammer_numbers.add(normalized)
        self._persist_scammers()
        logger.info("Flagged scammer: %s", phone_number)

    def is_scammer(self, phone_number: str) -> bool:
        normalized = self._normalize_phone(phone_number)
        return normalized in self.scammer_numbers

    def _persist_scammers(self) -> None:
        self._write_json(self._path("scammers.json"), list(self.scammer_numbers))
        self._save_index()


storage = Storage()
