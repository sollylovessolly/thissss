"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace("/auth");
    }, 900);

    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-6">
      <section className="flex flex-col items-center gap-5 text-center">
        <div className="relative">
          <div className="h-16 w-16 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-950/40">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
              <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4Zm0 2.19 7 3.11V11c0 4.36-2.83 8.64-7 9.9-4.17-1.26-7-5.54-7-9.9V6.3l7-3.11ZM11 7v5.17l4.24 2.52.76-1.28-3.5-2.08V7H11Z" />
            </svg>
          </div>
          <div className="absolute inset-0 rounded-2xl border border-violet-300/30 animate-ping" />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-normal">Commugate</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Preparing your encrypted session
          </p>
        </div>

        <div className="h-1 w-36 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full w-1/2 rounded-full bg-violet-500 animate-pulse" />
        </div>
      </section>
    </main>
  );
}
