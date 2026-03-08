"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

type MapIncident = {
  id: number;
  headline: string | null;
  date: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  incidentType: string | null;
};

// Dynamically import the actual map to avoid SSR issues with leaflet
const MapInner = dynamic(
  () => import("./incident-map-inner").then((mod) => mod.MapInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center text-warm-400 text-sm">
        Loading map...
      </div>
    ),
  }
);

export function IncidentMap({ incidents }: { incidents: MapIncident[] }) {
  const [showMap, setShowMap] = useState(false);

  return (
    <div className="mb-6">
      <button
        onClick={() => setShowMap(!showMap)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-warm-300 bg-white text-warm-700 hover:border-warm-400 transition-colors mb-3"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        {showMap ? "Hide Map" : `Show Map (${incidents.length} located)`}
      </button>

      {showMap && (
        <>
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          />
          <div className="rounded-lg overflow-hidden border border-warm-200 h-[400px]">
            <MapInner incidents={incidents} />
          </div>
        </>
      )}
    </div>
  );
}
