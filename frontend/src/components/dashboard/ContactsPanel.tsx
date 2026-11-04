"use client";

import { useEffect, useState } from "react";

interface Contact {
  id: number;
  name: string;
  phone_number: string;
  relationship: string;
  priority: string;
}

interface Props {
  onContactsChange: () => void;
}

const PRIORITY_COLORS = {
  high: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400",
};

export default function ContactsPanel({ onContactsChange }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone_number: "", relationship: "", priority: "medium" });
  const [saving, setSaving] = useState(false);

  const loadContacts = () => {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then(setContacts)
      .catch(() => {});
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.phone_number.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ name: "", phone_number: "", relationship: "", priority: "medium" });
      setShowForm(false);
      loadContacts();
      onContactsChange();
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    loadContacts();
    onContactsChange();
  };

  return (
    <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-white/5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Saved Contacts</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            High priority contacts bypass AI screening
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 dark:text-blue-400 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Contact
        </button>
      </div>

      {showForm && (
        <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name *"
              className="text-sm px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="tel"
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              placeholder="Phone number *"
              className="text-sm px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={form.relationship}
              onChange={(e) => setForm({ ...form, relationship: e.target.value })}
              placeholder="Relationship (e.g., mother, friend)"
              className="text-sm px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="text-sm px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="high">High — Bypass AI</option>
              <option value="medium">Medium — Urgent notify</option>
              <option value="low">Low — Normal log</option>
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAdd}
              disabled={saving || !form.name.trim() || !form.phone_number.trim()}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm({ name: "", phone_number: "", relationship: "", priority: "medium" }); }}
              className="text-sm px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">
          No contacts saved yet
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {contacts.map((c) => (
            <div key={c.id} className="px-4 py-3 flex items-center justify-between group">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${PRIORITY_COLORS[c.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.low}`}>
                      {c.priority.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="font-mono">{c.phone_number}</span>
                    {c.relationship && <span>· {c.relationship}</span>}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDelete(c.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-all p-1"
                title="Remove contact"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
