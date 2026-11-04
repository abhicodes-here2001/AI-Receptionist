"use client";

import { useState } from "react";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import VoiceOrb from "@/components/VoiceOrb";

export default function CallInterface() {
  const [phoneNumber, setPhoneNumber] = useState("");

  const { status, error, isSpeaking, micAmplitude, startSession, endSession } =
    useVoiceSession({
      phoneNumber,
      mode: "call",
    });

  const isInCall = status === "connected" || status === "bypass";

  const handleStartCall = () => {
    if (!phoneNumber.trim()) return;
    startSession();
  };

  const orbState = !isInCall
    ? status === "connecting" ? "connecting" : "idle"
    : isSpeaking ? "speaking" : "listening";

  if (isInCall || status === "connecting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
        <VoiceOrb state={orbState} amplitude={micAmplitude} />

        <p className="mt-6 text-sm text-gray-400 dark:text-gray-500">
          {status === "connecting"
            ? "Connecting..."
            : isSpeaking
              ? "AI is speaking..."
              : "Listening..."}
        </p>

        <p className="mt-4 text-xs text-gray-400 font-mono">{phoneNumber}</p>

        <button
          onClick={endSession}
          className="mt-6 w-14 h-14 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-colors active:scale-95 shadow-lg"
        >
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
          </svg>
        </button>

        {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <VoiceOrb state="idle" size="md" />

      <h1 className="mt-8 text-xl font-semibold text-gray-900 dark:text-white">
        Simulate a Call
      </h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
        Enter a phone number to simulate an incoming call.
      </p>

      <div className="mt-8 w-full max-w-xs">
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="Phone number"
          className="w-full px-4 py-3 text-center text-lg border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 font-mono"
        />
      </div>

      <button
        onClick={handleStartCall}
        disabled={!phoneNumber.trim()}
        className="mt-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium py-3 px-10 rounded-full text-base transition-all hover:shadow-lg active:scale-95 disabled:cursor-not-allowed"
      >
        Start Call
      </button>

      {status === "blocked" && (
        <p className="mt-4 text-red-600 text-sm">{error || "This number has been blocked."}</p>
      )}
      {status === "ended" && (
        <p className="mt-4 text-gray-500 text-sm">Call ended</p>
      )}
      {error && status === "error" && (
        <p className="mt-4 text-red-600 text-sm">{error}</p>
      )}
    </div>
  );
}
