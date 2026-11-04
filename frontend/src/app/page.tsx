"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [status, setStatus] = useState<{
    onboarding_complete: boolean;
    owner_name: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-gray-500">Loading...</div>
      </main>
    );
  }

  if (status?.onboarding_complete) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">
            {status.owner_name}&apos;s AI Receptionist
          </h1>
          <p className="text-gray-500 mb-8">
            Your virtual friend is ready to screen calls.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              View Dashboard
            </Link>
            <Link
              href="/call"
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Simulate Call
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="text-center max-w-md mx-auto px-4">
        <h1 className="text-3xl font-bold mb-4">AI Receptionist</h1>
        <p className="text-gray-500 mb-8">
          Set up your virtual friend to screen phone calls. It&apos;ll greet
          callers, identify who they are, and handle them based on your
          preferences.
        </p>
        <Link
          href="/onboarding"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors"
        >
          Get Started
        </Link>
      </div>
    </main>
  );
}
