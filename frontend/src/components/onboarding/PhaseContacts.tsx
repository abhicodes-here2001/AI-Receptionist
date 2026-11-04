"use client";

import { useState } from "react";

interface ContactRow {
  name: string;
  relationship: string;
  phone_number: string;
  priority: "high" | "medium" | "low";
}

interface Props {
  onComplete: (contacts: ContactRow[]) => void;
  onChange?: (contacts: ContactRow[]) => void;
}

const EMPTY_ROW: ContactRow = {
  name: "",
  relationship: "",
  phone_number: "",
  priority: "medium",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "border-red-300 dark:border-red-700",
  medium: "border-yellow-300 dark:border-yellow-700",
  low: "border-gray-200 dark:border-gray-700",
};

export default function PhaseContacts({ onComplete, onChange }: Props) {
  const [contacts, setContacts] = useState<ContactRow[]>([{ ...EMPTY_ROW }]);

  const updateContacts = (next: ContactRow[]) => {
    setContacts(next);
    onChange?.(next.filter((c) => c.name.trim() && c.phone_number.trim()));
  };

  const updateRow = (index: number, field: keyof ContactRow, value: string) => {
    const next = contacts.map((c, i) => (i === index ? { ...c, [field]: value } : c));
    updateContacts(next);
  };

  const addRow = () => updateContacts([...contacts, { ...EMPTY_ROW }]);

  const removeRow = (index: number) => {
    if (contacts.length <= 1) return;
    updateContacts(contacts.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const valid = contacts.filter((c) => c.name.trim() && c.phone_number.trim());
    onComplete(valid);
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Intro card */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
          Now add the people whose calls should be handled specially.
          <strong> High priority</strong> contacts bypass the AI directly.
          <strong> Medium</strong> triggers an urgent notification.
          <strong> Low</strong> gets logged normally. You can always update these later.
        </p>
      </div>

      {/* Contact rows */}
      <div className="space-y-3 mb-6">
        {contacts.map((contact, i) => (
          <div
            key={i}
            className={`border-l-4 ${PRIORITY_COLORS[contact.priority]} bg-white dark:bg-gray-900 rounded-lg p-4 shadow-sm`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Name"
                value={contact.name}
                onChange={(e) => updateRow(i, "name", e.target.value)}
                className="text-sm px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Relationship (e.g. Mom, Boss)"
                value={contact.relationship}
                onChange={(e) => updateRow(i, "relationship", e.target.value)}
                className="text-sm px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 items-center mt-3">
              <input
                type="tel"
                placeholder="Phone number"
                value={contact.phone_number}
                onChange={(e) => updateRow(i, "phone_number", e.target.value)}
                className="flex-1 text-sm px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={contact.priority}
                onChange={(e) => updateRow(i, "priority", e.target.value)}
                className="text-sm px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button
                onClick={() => removeRow(i)}
                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                disabled={contacts.length <= 1}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={addRow}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Contact
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => onComplete([])}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-4 py-2.5 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-full text-sm transition-all hover:shadow-lg active:scale-95"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
