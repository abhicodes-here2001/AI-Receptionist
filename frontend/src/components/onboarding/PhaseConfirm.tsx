"use client";

import { useState } from "react";

interface Props {
  ownerName: string;
  language: string;
  contactCount: number;
  deliveryInstructions: string;
  callPreferences: Record<string, string>;
  onConfirm: () => void;
}

export default function PhaseConfirm({
  ownerName,
  language,
  contactCount,
  deliveryInstructions,
  callPreferences,
  onConfirm,
}: Props) {
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    setConfirmed(true);
    setTimeout(() => onConfirm(), 1500);
  };

  if (confirmed) {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-xl shadow-green-500/30 animate-[orb-speak_1s_ease-in-out_infinite]">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          We&apos;re all set!
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
          Your AI receptionist is ready to handle calls. Taking you to the dashboard...
        </p>
      </div>
    );
  }

  const prefEntries = Object.entries(callPreferences);

  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Everything looks great!
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Here&apos;s a summary of your setup. Confirm to activate your AI receptionist.
        </p>
      </div>

      {/* Summary cards */}
      <div className="space-y-3 mb-8">
        {/* Identity card */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-500/5 dark:to-indigo-500/5 border border-blue-100 dark:border-blue-500/10 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-blue-600/60 dark:text-blue-400/60 uppercase tracking-wider">Owner</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{ownerName || "Not set"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4 text-blue-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            <span>Greeting language: <span className="font-medium capitalize text-gray-900 dark:text-white">{language || "english"}</span></span>
          </div>
        </div>

        {/* Contacts card */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-500/5 dark:to-teal-500/5 border border-emerald-100 dark:border-emerald-500/10 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-emerald-600/60 dark:text-emerald-400/60 uppercase tracking-wider">Contacts</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {contactCount} contact{contactCount !== 1 ? "s" : ""} saved
              </p>
            </div>
          </div>
        </div>

        {/* Delivery card */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/5 dark:to-orange-500/5 border border-amber-100 dark:border-amber-500/10 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-amber-600/60 dark:text-amber-400/60 uppercase tracking-wider">Delivery Instructions</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed pl-[52px]">
            {deliveryInstructions || "No specific instructions — will ask to leave at the door"}
          </p>
        </div>

        {/* Preferences card */}
        {prefEntries.length > 0 && (
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-500/5 dark:to-pink-500/5 border border-purple-100 dark:border-purple-500/10 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <p className="text-xs font-medium text-purple-600/60 dark:text-purple-400/60 uppercase tracking-wider">Call Preferences</p>
            </div>
            <div className="space-y-1.5 pl-[52px]">
              {prefEntries.map(([type, pref]) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-gray-600 dark:text-gray-300">{type}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    pref === "decline"
                      ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                      : "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
                  }`}>
                    {pref}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirm button */}
      <div className="text-center">
        <button
          onClick={handleConfirm}
          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3.5 px-12 rounded-full text-base transition-all shadow-lg shadow-green-500/25 hover:shadow-green-500/40 active:scale-95"
        >
          Confirm &amp; Activate
        </button>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          You can update these settings anytime from the dashboard
        </p>
      </div>
    </div>
  );
}
