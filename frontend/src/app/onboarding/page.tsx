"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import PhaseStepper from "@/components/onboarding/PhaseStepper";
import PhaseContacts from "@/components/onboarding/PhaseContacts";
import PhaseConfirm from "@/components/onboarding/PhaseConfirm";
import VoiceOrb from "@/components/VoiceOrb";
import { useVoiceSession } from "@/hooks/useVoiceSession";

type UIPhase = "voice" | "contacts" | "confirm";

interface OnboardingData {
  name: string;
  language: string;
  contacts: { name: string; relationship: string; phone_number: string; priority: string }[];
  deliveryInstructions: string;
  callPreferences: Record<string, string>;
  customRules: string[];
}

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [uiPhase, setUIPhase] = useState<UIPhase>("voice");
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    name: "",
    language: "english",
    contacts: [],
    deliveryInstructions: "",
    callPreferences: {},
    customRules: [],
  });
  const sessionStartedRef = useRef(false);
  const pendingFormContactsRef = useRef<{ name: string; relationship: string; phone_number: string; priority: string }[]>([]);
  const cancelAudioRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.onboarding_complete) router.replace("/dashboard");
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const handlePhaseComplete = useCallback(
    (phase: string | number, phaseData?: Record<string, unknown>) => {
      switch (phase) {
        case "basics_saved":
          if (phaseData) {
            setData((prev) => ({
              ...prev,
              name: (phaseData.name as string) || prev.name,
              language: (phaseData.language as string) || prev.language,
            }));
          }
          setStep(2);
          break;

        case "show_contacts":
          cancelAudioRef.current?.();
          setUIPhase("contacts");
          setStep(2);
          break;

        case "contact_added":
          if (phaseData) {
            setData((prev) => ({
              ...prev,
              contacts: [
                ...prev.contacts,
                {
                  name: (phaseData.name as string) || "",
                  phone_number: (phaseData.phone_number as string) || "",
                  relationship: (phaseData.relationship as string) || "",
                  priority: (phaseData.priority as string) || "medium",
                },
              ],
            }));
          }
          break;

        case "contacts_done": {
          const pending = pendingFormContactsRef.current;
          if (pending.length > 0) {
            Promise.all(
              pending.map((contact) =>
                fetch("/api/contacts", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(contact),
                })
              )
            ).then(() => {
              setData((prev) => ({
                ...prev,
                contacts: [...prev.contacts, ...pending],
              }));
              pendingFormContactsRef.current = [];
            });
          }
          setUIPhase("voice");
          setStep(3);
          break;
        }

        case "preferences_saved":
          if (phaseData) {
            setData((prev) => ({
              ...prev,
              deliveryInstructions: (phaseData.delivery_instructions as string) || "",
              callPreferences: (phaseData.call_preferences as Record<string, string>) || {},
              customRules: (phaseData.custom_rules as string[]) || [],
            }));
          }
          setUIPhase("confirm");
          setStep(4);
          break;
      }
    },
    []
  );

  const { status, error, isSpeaking, micAmplitude, startSession, endSession, sendMessage, cancelQueuedAudio } =
    useVoiceSession({
      mode: "onboarding",
      onboardingPhase: 0,
      onPhaseComplete: handlePhaseComplete,
    });

  cancelAudioRef.current = cancelQueuedAudio;

  // Auto-start the voice session once loaded
  useEffect(() => {
    if (!loading && !sessionStartedRef.current && status === "idle") {
      sessionStartedRef.current = true;
      startSession();
    }
  }, [loading, status, startSession]);

  const handleContactsComplete = useCallback(
    async (
      contacts: { name: string; relationship: string; phone_number: string; priority: string }[]
    ) => {
      for (const contact of contacts) {
        await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contact),
        });
      }
      setData((prev) => ({
        ...prev,
        contacts: [...prev.contacts, ...contacts],
      }));
      setUIPhase("voice");
      setStep(3);
      sendMessage({ type: "contacts_complete", count: contacts.length });
    },
    [sendMessage]
  );

  const handleConfirm = useCallback(async () => {
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        default_language: data.language,
        delivery_instructions: data.deliveryInstructions,
        call_preferences: data.callPreferences,
        custom_rules: data.customRules,
      }),
    });
    router.push("/dashboard");
  }, [data, router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-gray-500">Loading...</div>
      </main>
    );
  }

  const isActive = status === "connected";
  const orbState =
    !isActive
      ? status === "connecting"
        ? "connecting"
        : "idle"
      : isSpeaking
        ? "speaking"
        : "listening";

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <PhaseStepper current={step} />

        {/* Voice phase — full-screen orb */}
        {uiPhase === "voice" && (
          <div className="flex flex-col items-center justify-center min-h-[65vh]">
            {status === "idle" && !sessionStartedRef.current && (
              <div className="flex flex-col items-center gap-6">
                <VoiceOrb state="idle" />
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Let&apos;s set up your AI Receptionist
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
                    We&apos;ll have a quick conversation to get everything configured.
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
                <p className="text-amber-600 dark:text-amber-400 font-medium text-sm animate-pulse">
                  Connecting...
                </p>
              </div>
            )}

            {isActive && (
              <div className="flex flex-col items-center gap-4">
                <VoiceOrb state={orbState} amplitude={micAmplitude} />
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {isSpeaking ? "AI is speaking..." : "Listening..."}
                </p>
              </div>
            )}

            {status === "ended" && (
              <div className="flex flex-col items-center gap-4">
                <VoiceOrb state="idle" />
                <p className="text-gray-500 text-sm">Session ended</p>
                <button
                  onClick={() => {
                    sessionStartedRef.current = false;
                    startSession();
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Restart
                </button>
              </div>
            )}

            {error && (
              <p className="mt-4 text-red-600 text-sm text-center max-w-sm">{error}</p>
            )}
          </div>
        )}

        {/* Contacts phase — form + compact orb */}
        {uiPhase === "contacts" && (
          <div>
            {/* Compact voice orb — AI stays active during contacts entry */}
            {isActive && (
              <div className="flex items-center justify-center gap-3 mb-6 py-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                <VoiceOrb state={orbState} amplitude={micAmplitude} size="sm" />
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {isSpeaking ? "AI is speaking..." : "Listening — say a name to add by voice"}
                </div>
              </div>
            )}

            <PhaseContacts
              onComplete={handleContactsComplete}
              onChange={(contacts) => { pendingFormContactsRef.current = contacts; }}
            />
          </div>
        )}

        {/* Confirm phase */}
        {uiPhase === "confirm" && (
          <PhaseConfirm
            ownerName={data.name}
            language={data.language}
            contactCount={data.contacts.length}
            deliveryInstructions={data.deliveryInstructions}
            callPreferences={data.callPreferences}
            onConfirm={handleConfirm}
          />
        )}
      </div>
    </main>
  );
}
