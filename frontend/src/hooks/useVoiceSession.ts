"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getWsBaseUrl } from "./wsUrl";

export interface TranscriptEntry {
  role: "caller" | "ai";
  text: string;
}

export interface CallerInfo {
  caller_type: string;
  caller_name: string | null;
  priority: string;
  language: string;
  is_scammer: boolean;
}

interface VoiceSessionOptions {
  phoneNumber?: string;
  mode?: "call" | "onboarding";
  onboardingPhase?: number;
  onPhaseComplete?: (phase: string | number, data?: Record<string, unknown>) => void;
}

type SessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "blocked"
  | "bypass"
  | "ended"
  | "error";

export function useVoiceSession(options: VoiceSessionOptions = {}) {
  const {
    phoneNumber = "",
    mode = "call",
    onboardingPhase = 0,
    onPhaseComplete,
  } = options;

  const [status, setStatus] = useState<SessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [callerInfo, setCallerInfo] = useState<CallerInfo | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micAmplitude, setMicAmplitude] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playbackTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isActiveRef = useRef(false);
  const speakingCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cancelQueuedAudio = useCallback(() => {
    for (const src of scheduledSourcesRef.current) {
      try { src.stop(); } catch { /* already stopped */ }
    }
    scheduledSourcesRef.current = [];
    playbackTimeRef.current = 0;
    setIsSpeaking(false);
    if (speakingCheckRef.current) {
      clearInterval(speakingCheckRef.current);
      speakingCheckRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    isActiveRef.current = false;
    cancelQueuedAudio();

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [cancelQueuedAudio]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const startSession = useCallback(async () => {
    cleanup();
    setStatus("connecting");
    setError(null);
    setTranscript([]);
    setCallerInfo(null);
    setIsSpeaking(false);
    setMicAmplitude(0);
    isActiveRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule("/audio-processor.js");
      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(
        audioContext,
        "audio-capture-processor"
      );
      workletNodeRef.current = workletNode;

      const wsUrl = `${getWsBaseUrl()}/ws/voice`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: mode === "onboarding" ? "start_onboarding" : "start_call",
            phone_number: phoneNumber,
            phase: onboardingPhase,
          })
        );
      };

      workletNode.port.onmessage = (event) => {
        const { data, amplitude } = event.data;

        if (amplitude !== undefined) {
          setMicAmplitude(Math.min(1, amplitude * 4));
        }

        if (
          !isActiveRef.current ||
          !ws ||
          ws.readyState !== WebSocket.OPEN
        )
          return;

        const bytes = new Uint8Array(data);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        ws.send(JSON.stringify({ type: "audio_data", audio: base64 }));
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "status":
            if (msg.status === "connected") {
              setStatus("connected");
            } else if (msg.status === "bypass") {
              setStatus("bypass");
            }
            break;

          case "blocked":
            setStatus("blocked");
            setError(msg.reason || "This number has been blocked.");
            cleanup();
            break;

          case "audio_data":
            setIsSpeaking(true);
            playAudioQueued(msg.audio, audioContext, playbackTimeRef, scheduledSourcesRef);
            // Start polling for playback completion
            if (!speakingCheckRef.current) {
              speakingCheckRef.current = setInterval(() => {
                if (scheduledSourcesRef.current.length === 0 && audioContext.currentTime >= playbackTimeRef.current - 0.05) {
                  setIsSpeaking(false);
                  if (speakingCheckRef.current) {
                    clearInterval(speakingCheckRef.current);
                    speakingCheckRef.current = null;
                  }
                }
              }, 100);
            }
            break;

          case "audio_done":
            // Don't set isSpeaking false here — let the playback check handle it
            break;

          case "speech_started":
            cancelQueuedAudio();
            break;

          case "transcript":
            setTranscript((prev) => [
              ...prev,
              { role: msg.role, text: msg.text },
            ]);
            break;

          case "caller_info":
            setCallerInfo(msg);
            break;

          case "onboarding_phase_complete":
            onPhaseComplete?.(msg.phase, msg.data);
            break;

          case "error":
            setError(msg.message);
            setStatus("error");
            break;
        }
      };

      ws.onclose = () => {
        if (isActiveRef.current) {
          setStatus("ended");
        }
      };

      ws.onerror = () => {
        setError("WebSocket connection failed");
        setStatus("error");
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start voice session";
      setError(message);
      setStatus("error");
      cleanup();
    }
  }, [phoneNumber, mode, onboardingPhase, onPhaseComplete, cleanup, cancelQueuedAudio]);

  const endSession = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end_call" }));
    }
    setStatus("ended");
    cleanup();
  }, [cleanup]);

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return {
    status,
    error,
    transcript,
    callerInfo,
    isSpeaking,
    micAmplitude,
    startSession,
    endSession,
    sendMessage,
  };
}

function playAudioQueued(
  base64Audio: string,
  audioContext: AudioContext,
  playbackTimeRef: React.MutableRefObject<number>,
  scheduledSourcesRef: React.MutableRefObject<AudioBufferSourceNode[]>
) {
  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }

  const audioBuffer = audioContext.createBuffer(1, float32.length, 24000);
  audioBuffer.getChannelData(0).set(float32);

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  const startTime = Math.max(audioContext.currentTime + 0.01, playbackTimeRef.current);
  source.start(startTime);
  playbackTimeRef.current = startTime + audioBuffer.duration;

  scheduledSourcesRef.current.push(source);
  source.onended = () => {
    scheduledSourcesRef.current = scheduledSourcesRef.current.filter((s) => s !== source);
  };
}
