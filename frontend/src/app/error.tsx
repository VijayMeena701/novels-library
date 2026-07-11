"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 px-6 py-16 text-white">
        <main className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/10 p-8 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-300">Application error</p>
          <h1 className="mt-3 text-3xl font-black">We could not load this page.</h1>
          <p className="mt-3 break-words text-sm text-slate-300">{error.message || "An unexpected error occurred."}</p>
          <button type="button" onClick={() => reset()} className="mt-6 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-200">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
