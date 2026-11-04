"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CallLogList from "@/components/dashboard/CallLogList";
import ContactsPanel from "@/components/dashboard/ContactsPanel";
import { useDashboardWS } from "@/hooks/useDashboardWS";

export default function DashboardPage() {
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [contactCount, setContactCount] = useState(0);
  const [defaultLanguage, setDefaultLanguage] = useState<string | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const { calls } = useDashboardWS();

  const refreshStatus = () => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => {
        setOwnerName(data.owner_name);
        setContactCount(data.contact_count ?? 0);
        setDefaultLanguage(data.default_language ?? null);
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const totalCalls = calls.length;
  const highPriority = calls.filter((c) => c.priority === "high").length;
  const blocked = calls.filter((c) => c.action_taken === "blocked" || c.action_taken === "auto_blocked").length;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                {ownerName ? `${ownerName}'s Receptionist` : "AI Receptionist"}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Real-time call monitoring
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowContacts(!showContacts)}
              className={`flex items-center gap-2 font-medium px-4 py-2 rounded-xl text-sm transition-all active:scale-95 ${
                showContacts
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-300"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Contacts
            </button>
            <Link
              href="/call"
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/30 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Simulate Call
            </Link>
          </div>
        </div>
      </header>

      {/* Stats grid */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total Calls"
            value={String(totalCalls)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            }
            color="blue"
          />
          <StatCard
            label="High Priority"
            value={String(highPriority)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            }
            color="red"
          />
          <StatCard
            label="Contacts"
            value={String(contactCount)}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            color="purple"
          />
          <StatCard
            label={defaultLanguage ? "Language" : "Blocked"}
            value={defaultLanguage ? capitalize(defaultLanguage) : String(blocked)}
            icon={
              defaultLanguage ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              )
            }
            color="green"
          />
        </div>
      </div>

      {/* Contacts Panel */}
      {showContacts && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-4">
          <ContactsPanel onContactsChange={refreshStatus} />
        </div>
      )}

      {/* Call Logs */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Call History
          </h2>
          {totalCalls > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {totalCalls} call{totalCalls !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <CallLogList />
      </div>
    </main>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "blue" | "purple" | "green" | "red";
}) {
  const colors = {
    blue: "from-blue-500/10 to-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/10",
    purple: "from-purple-500/10 to-purple-500/5 text-purple-600 dark:text-purple-400 border-purple-500/10",
    green: "from-green-500/10 to-green-500/5 text-green-600 dark:text-green-400 border-green-500/10",
    red: "from-red-500/10 to-red-500/5 text-red-600 dark:text-red-400 border-red-500/10",
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-3 sm:p-4`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide opacity-70">
          {label}
        </span>
      </div>
      <p className="text-lg sm:text-xl font-bold">{value}</p>
    </div>
  );
}
