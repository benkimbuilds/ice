"use client";

import { useState } from "react";
import { uploadCsv } from "@/app/admin/incidents/csv-action";

export function CsvUploadForm() {
  const [isPending, setIsPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setIsPending(true);
        setResult(null);
        try {
          const msg = await uploadCsv(formData);
          setResult(msg);
        } catch (e: any) {
          setResult("Error: " + e.message);
        } finally {
          setIsPending(false);
        }
      }}
      className="flex items-center gap-2"
    >
      <input
        type="file"
        name="file"
        accept=".csv"
        className="text-sm text-warm-500 file:mr-2 file:px-3 file:py-1.5 file:border file:border-warm-300 file:bg-white file:text-sm file:font-medium file:text-warm-700 file:cursor-pointer hover:file:bg-warm-50"
      />
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 border border-warm-300 text-sm font-medium hover:bg-warm-50 disabled:opacity-50"
      >
        {isPending ? "Uploading..." : "Upload CSV"}
      </button>
      {result && <span className="text-sm text-warm-500">{result}</span>}
    </form>
  );
}
