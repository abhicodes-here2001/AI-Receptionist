"use client";

const PHASES = [
  { num: 1, label: "Basics" },
  { num: 2, label: "Contacts" },
  { num: 3, label: "Preferences" },
  { num: 4, label: "Confirm" },
];

export default function PhaseStepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {PHASES.map((phase, i) => (
        <div key={phase.num} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-all ${
                phase.num < current
                  ? "bg-green-500 text-white"
                  : phase.num === current
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
              }`}
            >
              {phase.num < current ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                phase.num
              )}
            </div>
            <span
              className={`text-[10px] hidden sm:block ${
                phase.num === current
                  ? "font-semibold text-blue-600 dark:text-blue-400"
                  : phase.num < current
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-400 dark:text-gray-500"
              }`}
            >
              {phase.label}
            </span>
          </div>
          {i < PHASES.length - 1 && (
            <div
              className={`w-8 sm:w-12 h-0.5 mx-1 rounded-full transition-colors ${
                phase.num < current
                  ? "bg-green-400"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
