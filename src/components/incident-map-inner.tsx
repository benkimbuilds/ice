"use client";

import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

type MapIncident = {
  id: number;
  headline: string | null;
  date: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  incidentType: string | null;
};

function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount();
  let size = "small";
  if (count >= 50) size = "large";
  else if (count >= 10) size = "medium";

  const sizes: Record<string, { dim: number; fontSize: string }> = {
    small: { dim: 32, fontSize: "12px" },
    medium: { dim: 40, fontSize: "13px" },
    large: { dim: 48, fontSize: "14px" },
  };
  const s = sizes[size];

  return L.divIcon({
    html: `<div style="
      background: rgba(234,88,12,0.85);
      color: white;
      border-radius: 50%;
      width: ${s.dim}px;
      height: ${s.dim}px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: ${s.fontSize};
      border: 2px solid rgba(194,65,12,0.9);
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    ">${count}</div>`,
    className: "",
    iconSize: L.point(s.dim, s.dim),
  });
}

export function MapInner({ incidents }: { incidents: MapIncident[] }) {
  return (
    <MapContainer
      center={[39.8, -98.5]}
      zoom={4}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MarkerClusterGroup
        chunkedLoading
        iconCreateFunction={createClusterIcon}
      >
        {incidents.map((inc) => (
          <CircleMarker
            key={inc.id}
            center={[inc.latitude!, inc.longitude!]}
            radius={7}
            pathOptions={{
              color: "#c2410c",
              fillColor: "#ea580c",
              fillOpacity: 0.8,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-sm max-w-[250px]">
                <p className="font-semibold text-warm-900 mb-1">{inc.headline}</p>
                {inc.location && (
                  <p className="text-warm-500 text-xs">{inc.location}</p>
                )}
                {inc.date && (
                  <p className="text-warm-500 text-xs">{inc.date}</p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
