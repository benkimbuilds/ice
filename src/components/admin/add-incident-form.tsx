"use client";

import { useState } from "react";
import { createIncident } from "@/app/admin/incidents/actions";

function AltSourcesList({
  sources,
  onChange,
}: {
  sources: string[];
  onChange: (sources: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      {sources.map((src, i) => (
        <div key={i} className="flex gap-2">
          <input
            name="altSources[]"
            value={src}
            onChange={(e) => {
              const next = [...sources];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder="https://..."
            className="flex-1 px-3 py-2 border border-warm-300 text-sm focus:outline-none focus:border-warm-900"
          />
          <button
            type="button"
            onClick={() => onChange(sources.filter((_, j) => j !== i))}
            className="px-2 text-warm-400 hover:text-red-600 text-lg leading-none"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...sources, ""])}
        className="text-xs text-warm-500 hover:text-warm-900 underline"
      >
        + Add source URL
      </button>
    </div>
  );
}

export function AddIncidentForm() {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [altSources, setAltSources] = useState<string[]>([]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-warm-900 text-white text-sm font-medium hover:bg-warm-800 transition-colors"
      >
        + Add Incident
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        setIsPending(true);
        try {
          await createIncident(formData);
          setOpen(false);
          setAltSources([]);
        } catch (e: any) {
          alert(e.message);
        } finally {
          setIsPending(false);
        }
      }}
      className="border border-warm-200 p-4 space-y-3 bg-white"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-warm-500 mb-1">URL *</label>
          <input name="url" required className="w-full px-3 py-2 border border-warm-300 text-sm focus:outline-none focus:border-warm-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-warm-500 mb-1">Headline</label>
          <input name="headline" className="w-full px-3 py-2 border border-warm-300 text-sm focus:outline-none focus:border-warm-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-warm-500 mb-1">Date</label>
          <input name="date" placeholder="MM/DD/YYYY" className="w-full px-3 py-2 border border-warm-300 text-sm focus:outline-none focus:border-warm-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-warm-500 mb-1">Location</label>
          <input name="location" className="w-full px-3 py-2 border border-warm-300 text-sm focus:outline-none focus:border-warm-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-warm-500 mb-1">Incident Type</label>
          <input name="incidentType" placeholder="Detained, Officer Use Of Force" className="w-full px-3 py-2 border border-warm-300 text-sm focus:outline-none focus:border-warm-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-warm-500 mb-1">Country</label>
          <input name="country" className="w-full px-3 py-2 border border-warm-300 text-sm focus:outline-none focus:border-warm-900" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-warm-500 mb-1">Summary</label>
          <textarea name="summary" rows={2} className="w-full px-3 py-2 border border-warm-300 text-sm focus:outline-none focus:border-warm-900" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-warm-500 mb-1">Additional Sources</label>
          <AltSourcesList sources={altSources} onChange={setAltSources} />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-warm-900 text-white text-sm font-medium hover:bg-warm-800 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setAltSources([]); }}
          className="px-4 py-2 text-sm text-warm-500 hover:text-warm-900"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
