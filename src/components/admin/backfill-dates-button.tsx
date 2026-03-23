"use client";

import { useState } from "react";

export function BackfillDatesButton() {
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={async () => {
          if (
            !confirm(
              "Fetch dates from source URLs for all incidents missing dates? This may take a few minutes."
            )
          )
            return;
          setIsPending(true);
          setResult(null);
          try {
            const res = await fetch("/api/cron/backfill-dates", {
              method: "POST",
              headers: { "x-edit-password": "acab" },
            });
            const text = await res.text();
            // Get the last meaningful line as the summary
            const lines = text.trim().split("\n").filter(Boolean);
            const summary = lines[lines.length - 1] || "Done";
            setResult(summary);
          } catch (e: any) {
            setResult("Error: " + e.message);
          } finally {
            setIsPending(false);
          }
        }}
        disabled={isPending}
        className="px-4 py-2 border border-warm-300 text-sm font-medium hover:bg-warm-50 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Fetching dates..." : "Backfill Dates from Sources"}
      </button>
      {result && <span className="text-sm text-warm-500">{result}</span>}
    </div>
  );
}
