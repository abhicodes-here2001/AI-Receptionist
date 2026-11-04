import Link from "next/link";
import CallInterface from "@/components/call/CallInterface";

export default function CallPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <nav className="px-6 py-3 flex items-center gap-4 border-b border-gray-100 dark:border-gray-800">
        <Link
          href="/dashboard"
          className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>
      </nav>
      <CallInterface />
    </main>
  );
}
