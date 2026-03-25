"use client";

import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";

type MapIncident = {
  id: number;
  url: string;
  headline: string | null;
  summary: string | null;
  date: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  incidentType: string | null;
  altSources: string | null;
};

// Custom orange dot marker
const dotIcon = L.divIcon({
  className: "",
  html: `<div style="width:10px;height:10px;border-radius:50%;background:#ea580c;border:2px solid #9a3412;opacity:0.9;"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

// Custom cluster icon
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 32 : count < 100 ? 38 : 46;
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:#ea580c;color:#fff;font-weight:700;
      font-size:${size < 38 ? 12 : 13}px;font-family:sans-serif;
      display:flex;align-items:center;justify-content:center;
      border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25);
    ">${count}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function parseAltSources(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function IncidentPopup({ inc }: { inc: MapIncident }) {
  const [expanded, setExpanded] = useState(false);
  const altUrls = parseAltSources(inc.altSources);
  const allUrls = [inc.url, ...altUrls];

  return (
    <div className="text-sm max-w-[300px]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="font-semibold mb-1 leading-snug text-orange-600 hover:text-orange-800 hover:underline block text-left cursor-pointer"
      >
        {inc.headline || "Untitled"}
      </button>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {inc.date && <span>{inc.date}</span>}
        {inc.location && <span>{inc.location}</span>}
      </div>

      {expanded && (
        <div className="mt-2">
          {inc.summary && (
            <p className="text-xs text-gray-700 leading-relaxed mb-2">{inc.summary}</p>
          )}
          <div className="border-t border-gray-200 pt-1.5 mt-1.5">
            <p className="text-[10px] font-medium text-gray-400 uppercase mb-1">Sources</p>
            {allUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-600 hover:text-blue-800 hover:underline truncate mb-0.5"
              >
                {getDomain(url)}
              </a>
            ))}
          </div>
          <button
            onClick={() => {
              const el = document.getElementById(`incident-${inc.id}`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ring-2", "ring-orange-400", "bg-orange-50/50", "rounded-lg");
                el.click();
                setTimeout(() => el.classList.remove("ring-2", "ring-orange-400", "bg-orange-50/50", "rounded-lg"), 4000);
              } else {
                window.location.href = `/?highlight=${inc.id}`;
              }
            }}
            className="mt-2 text-xs text-orange-600 hover:text-orange-800 hover:underline cursor-pointer"
          >
            View on page
          </button>
        </div>
      )}
    </div>
  );
}

export function MapInner({ incidents }: { incidents: MapIncident[] }) {
  return (
    <MapContainer
      center={[38.5, -96.5]}
      zoom={4}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        opacity={0.55}
      />

      <MarkerClusterGroup
        iconCreateFunction={createClusterIcon}
        maxClusterRadius={50}
        showCoverageOnHover={false}
        chunkedLoading
      >
        {incidents.map((inc) => (
          <Marker
            key={inc.id}
            position={[inc.latitude!, inc.longitude!]}
            icon={dotIcon}
          >
            <Popup>
              <IncidentPopup inc={inc} />
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
