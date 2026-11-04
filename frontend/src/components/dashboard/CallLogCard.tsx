"use client";

import { useState } from "react";
import type { CallLog } from "@/hooks/useDashboardWS";

interface Props {
  call: CallLog;
  onFlagSpam: (phoneNumber: string) => void;
  onVerifyType: (callId: number, type: string) => void;
  onAddContact: (callId: number, name: string, relationship: string, priority: string) => void;
}

const PRIORITY_CONFIG = {
  high: {
    bg: "bg-red-500/10 dark:bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
    badge: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
    border: "border-l-red-500",
    dot: "bg-red-500",
    icon: "!",
  },
  medium: {
    bg: "bg-amber-500/10 dark:bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
    border: "border-l-amber-400",
    dot: "bg-amber-400",
    icon: "~",
  },
  low: {
    bg: "bg-gray-500/5 dark:bg-gray-500/5",
    text: "text-gray-500 dark:text-gray-400",
    badge: "bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400",
    border: "border-l-gray-300 dark:border-l-gray-600",
    dot: "bg-gray-400",
    icon: "·",
  },
};

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  took_message: { label: "Message taken", color: "text-blue-600 dark:text-blue-400" },
  blocked: { label: "Blocked", color: "text-red-600 dark:text-red-400" },
  auto_blocked: { label: "Auto-blocked", color: "text-red-600 dark:text-red-400" },
  gave_delivery_instructions: { label: "Delivery handled", color: "text-green-600 dark:text-green-400" },
  screening: { label: "Screening", color: "text-amber-600 dark:text-amber-400" },
  bypassed: { label: "Bypassed", color: "text-purple-600 dark:text-purple-400" },
};

export default function CallLogCard({ call, onFlagSpam, onVerifyType, onAddContact }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [verifyInput, setVerifyInput] = useState("");
  const [showVerify, setShowVerify] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", relationship: "", priority: "medium" });

  const prio = PRIORITY_CONFIG[call.priority] || PRIORITY_CONFIG.low;
  const action = ACTION_CONFIG[call.action_taken] || { label: call.action_taken, color: "text-gray-500" };
  const callerType = call.owner_verified_type || call.type || "screening";
  const timeAgo = getTimeAgo(call.timestamp);

  return (
    <div className={`group border-l-4 ${prio.border} bg-white dark:bg-white/[0.03] rounded-xl shadow-sm hover:shadow-md transition-all mb-3 overflow-hidden`}>
      {/* Main content — always visible */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Top row: name/number + type */}
            <div className="flex items-center gap-2 flex-wrap">
              {call.caller_name ? (
                <span className="font-semibold text-sm text-gray-900 dark:text-white">
                  {call.caller_name}
                </span>
              ) : (
                <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                  {call.phone_number}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${prio.badge}`}>
                {call.priority.toUpperCase()}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                {callerType}
              </span>
            </div>

            {/* Second row: message preview */}
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
              {call.message || "No message recorded"}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-3 mt-2 text-xs">
              <span className={`font-medium ${action.color}`}>
                {action.label}
              </span>
              {call.caller_name && (
                <span className="text-gray-400 font-mono">{call.phone_number}</span>
              )}
              {call.language_states.length > 0 && (
                <span className="text-gray-400">
                  {call.language_states.map((l) => l.charAt(0).toUpperCase() + l.slice(1)).join(" → ")}
                </span>
              )}
            </div>
          </div>

          {/* Right side: time + expand */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-[11px] text-gray-400 whitespace-nowrap">{timeAgo}</span>
            <svg
              className={`w-4 h-4 text-gray-300 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-white/5">
          {/* Action buttons */}
          <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2">
            <ActionBtn
              label="Add to Contacts"
              onClick={() => setShowAddContact(!showAddContact)}
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              }
              variant="blue"
            />
            <ActionBtn
              label="Mark Spam"
              onClick={() => onFlagSpam(call.phone_number)}
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              }
              variant="red"
            />
            <ActionBtn
              label="Verify Type"
              onClick={() => setShowVerify(!showVerify)}
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              variant="gray"
            />
          </div>

          {/* Verify Type Input */}
          {showVerify && (
            <div className="px-4 pb-3">
              <div className="flex gap-2 bg-gray-50 dark:bg-white/5 rounded-lg p-2">
                <input
                  type="text"
                  value={verifyInput}
                  onChange={(e) => setVerifyInput(e.target.value)}
                  placeholder="Correct type (e.g., recruiter)"
                  className="flex-1 text-sm px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (verifyInput.trim()) {
                      onVerifyType(call.call_id, verifyInput.trim());
                      setShowVerify(false);
                      setVerifyInput("");
                    }
                  }}
                  className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Add Contact Form */}
          {showAddContact && (
            <div className="px-4 pb-3">
              <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="Name"
                  className="w-full text-sm px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={contactForm.relationship}
                    onChange={(e) => setContactForm({ ...contactForm, relationship: e.target.value })}
                    placeholder="Relationship"
                    className="flex-1 text-sm px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={contactForm.priority}
                    onChange={(e) => setContactForm({ ...contactForm, priority: e.target.value })}
                    className="text-sm px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <button
                  onClick={() => {
                    if (contactForm.name.trim()) {
                      onAddContact(call.call_id, contactForm.name, contactForm.relationship, contactForm.priority);
                      setShowAddContact(false);
                      setContactForm({ name: "", relationship: "", priority: "medium" });
                    }
                  }}
                  className="w-full text-sm py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Save Contact
                </button>
              </div>
            </div>
          )}

          {/* Conversation History */}
          {call.conversation_history.length > 0 && (
            <div className="px-4 pb-4">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Transcript
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg bg-gray-50 dark:bg-white/[0.02] p-3">
                {call.conversation_history.map((turn, i) => (
                  <div
                    key={i}
                    className={`text-sm leading-relaxed ${
                      turn.role === "caller"
                        ? "text-blue-700 dark:text-blue-400"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    <span className="font-semibold text-[11px] uppercase tracking-wide opacity-60">
                      {turn.role === "caller" ? "Caller" : "AI"}
                    </span>{" "}
                    {turn.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  icon,
  variant,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  variant: "blue" | "red" | "gray";
}) {
  const colors = {
    blue: "bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 dark:text-blue-400",
    red: "bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400",
    gray: "bg-gray-50 hover:bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:hover:bg-gray-500/20 dark:text-gray-400",
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${colors[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}
