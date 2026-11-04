"use client";

interface VoiceOrbProps {
  state: "idle" | "connecting" | "listening" | "speaking";
  amplitude?: number; // 0-1, mic amplitude when listening
  size?: "sm" | "md" | "lg";
}

export default function VoiceOrb({ state, amplitude = 0, size = "lg" }: VoiceOrbProps) {
  const sizeMap = { sm: 80, md: 120, lg: 160 };
  const px = sizeMap[size];

  const listenScale = state === "listening" ? 1 + amplitude * 0.25 : 1;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: px * 1.8, height: px * 1.8 }}
    >
      {/* Expanding rings when speaking */}
      {state === "speaking" && (
        <>
          <div
            className="absolute rounded-full bg-blue-400/10 animate-[orb-ring_2s_ease-out_infinite]"
            style={{ width: px * 1.6, height: px * 1.6 }}
          />
          <div
            className="absolute rounded-full bg-blue-400/15 animate-[orb-ring_2s_ease-out_infinite_0.6s]"
            style={{ width: px * 1.3, height: px * 1.3 }}
          />
        </>
      )}

      {/* Amplitude ring when listening */}
      {state === "listening" && amplitude > 0.05 && (
        <div
          className="absolute rounded-full bg-emerald-400/20 transition-transform duration-100"
          style={{
            width: px * 1.2,
            height: px * 1.2,
            transform: `scale(${1 + amplitude * 0.4})`,
          }}
        />
      )}

      {/* Glow */}
      <div
        className={`absolute rounded-full blur-2xl transition-all duration-300 ${
          state === "speaking"
            ? "bg-blue-500/30 opacity-100"
            : state === "listening"
              ? "bg-emerald-500/20 opacity-100"
              : state === "connecting"
                ? "bg-amber-500/20 opacity-100"
                : "bg-gray-500/10 opacity-40"
        }`}
        style={{ width: px * 1.1, height: px * 1.1 }}
      />

      {/* Main orb */}
      <div
        className={`relative z-10 rounded-full flex items-center justify-center shadow-2xl overflow-hidden ${
          state === "speaking"
            ? "bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 animate-[orb-speak_1s_ease-in-out_infinite]"
            : state === "listening"
              ? "bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600"
              : state === "connecting"
                ? "bg-gradient-to-br from-amber-400 via-orange-500 to-red-400 animate-pulse"
                : "bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600"
        }`}
        style={{
          width: px,
          height: px,
          transform: state === "listening" ? `scale(${listenScale})` : undefined,
          transition: state === "listening" ? "transform 100ms ease-out" : undefined,
        }}
      >
        {/* Inner highlight */}
        <div
          className="absolute rounded-full bg-white/10"
          style={{
            width: px * 0.6,
            height: px * 0.6,
            top: px * 0.1,
            left: px * 0.15,
          }}
        />

        {/* Animated bars — like ChatGPT voice mode */}
        <div className="relative z-10 flex items-center justify-center gap-[3px]">
          {state === "speaking" ? (
            <SpeakingBars barSize={px * 0.035} barHeight={px * 0.22} />
          ) : state === "listening" ? (
            <ListeningBars barSize={px * 0.035} barHeight={px * 0.22} amplitude={amplitude} />
          ) : state === "connecting" ? (
            <ConnectingDots dotSize={px * 0.06} />
          ) : (
            <IdleBars barSize={px * 0.035} barHeight={px * 0.08} />
          )}
        </div>
      </div>
    </div>
  );
}

function SpeakingBars({ barSize, barHeight }: { barSize: number; barHeight: number }) {
  const delays = [0, 0.15, 0.3, 0.1, 0.25];
  return (
    <>
      {delays.map((delay, i) => (
        <div
          key={i}
          className="bg-white/90 rounded-full animate-[eq-bar_0.6s_ease-in-out_infinite_alternate]"
          style={{
            width: barSize,
            height: barHeight * 0.4,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </>
  );
}

function ListeningBars({
  barSize,
  barHeight,
  amplitude,
}: {
  barSize: number;
  barHeight: number;
  amplitude: number;
}) {
  const heights = [0.3, 0.5, 0.7, 0.5, 0.3];
  return (
    <>
      {heights.map((h, i) => (
        <div
          key={i}
          className="bg-white/90 rounded-full transition-all duration-100"
          style={{
            width: barSize,
            height: Math.max(barSize, barHeight * h * (0.3 + amplitude * 0.7)),
          }}
        />
      ))}
    </>
  );
}

function ConnectingDots({ dotSize }: { dotSize: number }) {
  return (
    <>
      {[0, 0.2, 0.4].map((delay, i) => (
        <div
          key={i}
          className="bg-white/80 rounded-full animate-[eq-dot_1s_ease-in-out_infinite]"
          style={{
            width: dotSize,
            height: dotSize,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </>
  );
}

function IdleBars({ barSize, barHeight }: { barSize: number; barHeight: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-white/50 rounded-full"
          style={{ width: barSize, height: barHeight }}
        />
      ))}
    </>
  );
}
