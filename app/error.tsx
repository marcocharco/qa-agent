"use client";

import { btn } from "@/components/ui";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 max-w-xl text-muted">
        Usually the local database is not running or <code className="font-mono text-sm">DATABASE_URL</code> is missing from <code className="font-mono text-sm">.env.local</code>.
      </p>
      <p className="mt-3 max-w-xl font-mono text-sm text-muted">{error.message.slice(0, 200)}</p>
      <button className={`${btn} mt-6`} onClick={reset}>Try again</button>
    </main>
  );
}
