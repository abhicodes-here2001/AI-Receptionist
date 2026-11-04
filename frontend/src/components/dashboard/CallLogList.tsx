"use client";

import { useDashboardWS } from "@/hooks/useDashboardWS";
import CallLogCard from "./CallLogCard";

export default function CallLogList() {
  const { calls, connected, sendAction } = useDashboardWS();

  const handleFlagSpam = async (phoneNumber: string) => {
    await fetch("/api/calls/flag-spam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number: phoneNumber }),
    });
    sendAction({ type: "flag_spam", phone_number: phoneNumber });
  };

  const handleVerifyType = async (callId: number, type: string) => {
    await fetch("/api/calls/verify-type", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ call_id: callId, verified_type: type }),
    });
  };

  const handleAddContact = async (
    callId: number,
    name: string,
    relationship: string,
    priority: string
  ) => {
    await fetch("/api/calls/add-contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        call_id: callId,
        name,
        relationship,
        priority,
      }),
    });
  };

  return (
    <div>
      {/* Connection indicator */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
          {connected && (
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping opacity-75" />
          )}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-500 font-medium">
          {connected ? "Live — updates in real time" : "Reconnecting..."}
        </span>
      </div>

      {/* Call logs */}
      {calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <p className="text-base font-medium text-gray-500 dark:text-gray-400 mb-1">
            No calls yet
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
            Simulate a call to see it appear here in real time. Your AI receptionist is ready.
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {calls.map((call) => (
            <CallLogCard
              key={call.call_id}
              call={call}
              onFlagSpam={handleFlagSpam}
              onVerifyType={handleVerifyType}
              onAddContact={handleAddContact}
            />
          ))}
        </div>
      )}
    </div>
  );
}
