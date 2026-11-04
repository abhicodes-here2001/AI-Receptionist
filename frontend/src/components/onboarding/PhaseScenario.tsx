"use client";

import { useVoiceSession } from "@/hooks/useVoiceSession";
import { useCallback, useEffect, useRef, useState } from "react";
import VoiceOrb from "@/components/VoiceOrb";

interface Props {
  onComplete: () => void;
}

export default function PhaseScenario({ onComplete }: Props) {
  const [waitingToTransition, setWaitingToTransition] = useState(false);

  const handlePhaseComplete = useCallback(
    (phase: string | number) => {
      if (phase === 4 || phase === "scenario_complete") {
        setWaitingToTransition(true);
      }
    },
    []
  );

  const { status, error, isSpeaking, micAmplitude, startSession, endSession } =
    useVoiceSession({
      mode: "onboarding",
      onboardingPhase: 4,
      onPhaseComplete: handlePhaseComplete,
    });

  useEffect(() => {
    if (!waitingToTransition) return;
    if (isSpeaking) return;

    const timer = setTimeout(() => {
      onComplete();
    }, 800);
    return () => clearTimeout(timer);
  }, [waitingToTransition, isSpeaking, onComplete]);

  const isActive = status === "connected";

  const orbState = !isActive
    ? status === "connecting" ? "connecting" : "idle"
    : isSpeaking ? "speaking" : "listening";

  return (
    <div className="flex flex-col items-center min-h-[60vh] justify-center">
      {status === "idle" && (
        <div className="flex flex-col items-center gap-6">
          <VoiceOrb state="idle" />
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Quick scenario test
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
              The AI will roleplay a few caller scenarios to show you how it handles them.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 mt-2">
            <button
              onClick={startSession}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-10 rounded-full text-base transition-all hover:shadow-lg active:scale-95"
            >
              Start Test
            </button>
            <button
              onClick={onComplete}
              className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Skip this step
            </button>
          </div>
        </div>
      )}

      {status === "connecting" && (
        <div className="flex flex-col items-center gap-6">
          <VoiceOrb state="connecting" />
          <p className="text-amber-600 dark:text-amber-400 font-medium text-sm">Connecting...</p>
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

      {error && <p className="mt-4 text-red-600 text-sm text-center">{error}</p>}
    </div>
  );
}
