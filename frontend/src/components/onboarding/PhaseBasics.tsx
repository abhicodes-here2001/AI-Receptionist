"use client";

import { useVoiceSession } from "@/hooks/useVoiceSession";
import { useCallback, useEffect, useRef, useState } from "react";
import VoiceOrb from "@/components/VoiceOrb";

interface Props {
  onComplete: (data: { name: string; language: string }) => void;
}

export default function PhaseBasics({ onComplete }: Props) {
  const pendingRef = useRef<{ name: string; language: string } | null>(null);
  const [waitingToTransition, setWaitingToTransition] = useState(false);

  const handlePhaseComplete = useCallback(
    (phase: string | number, data?: Record<string, unknown>) => {
      if ((phase === 1 || phase === "basics_saved") && data) {
        pendingRef.current = {
          name: (data.name as string) || "",
          language: (data.language as string) || "english",
        };
        setWaitingToTransition(true);
      }
    },
    []
  );

  const { status, error, isSpeaking, micAmplitude, startSession, endSession } =
    useVoiceSession({
      mode: "onboarding",
      onboardingPhase: 1,
      onPhaseComplete: handlePhaseComplete,
    });

  // Wait for AI to finish speaking the next-step introduction, then transition
  useEffect(() => {
    if (!waitingToTransition || !pendingRef.current) return;
    if (isSpeaking) return;

    const timer = setTimeout(() => {
      if (pendingRef.current) {
        onComplete(pendingRef.current);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [waitingToTransition, isSpeaking, onComplete]);

  const isActive = status === "connected";

  const orbState = !isActive
    ? status === "connecting"
      ? "connecting"
      : "idle"
    : isSpeaking
      ? "speaking"
      : "listening";

  return (
    <div className="flex flex-col items-center min-h-[60vh] justify-center">
      {status === "idle" && (
        <div className="flex flex-col items-center gap-6">
          <VoiceOrb state="idle" />
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Let&apos;s get started
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
              Tap start and tell the AI your name and preferred language.
            </p>
          </div>
          <button
            onClick={startSession}
            className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-10 rounded-full text-base transition-all hover:shadow-lg active:scale-95"
          >
            Start
          </button>
        </div>
      )}

      {status === "connecting" && (
        <div className="flex flex-col items-center gap-6">
          <VoiceOrb state="connecting" />
          <p className="text-amber-600 dark:text-amber-400 font-medium text-sm">
            Connecting...
          </p>
        </div>
      )}

      {isActive && (
        <div className="flex flex-col items-center gap-4">
          <VoiceOrb state={orbState} amplitude={micAmplitude} />
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {isSpeaking ? "Speaking..." : "Listening..."}
          </p>
          <button
            onClick={endSession}
            className="mt-4 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-medium py-2 px-6 rounded-full text-sm transition-colors"
          >
            End
          </button>
        </div>
      )}

      {status === "ended" && (
        <div className="flex flex-col items-center gap-4">
          <VoiceOrb state="idle" />
          <p className="text-gray-500 text-sm">Session ended</p>
        </div>
      )}

      {error && (
        <p className="mt-4 text-red-600 text-sm text-center">{error}</p>
      )}
    </div>
  );
}
