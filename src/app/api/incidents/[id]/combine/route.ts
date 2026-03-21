import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseAltSources } from "@/lib/sources";
import { synthesizeIncidents, serializeTimeline } from "@/lib/extractor";
import { extractPersonName, nameMatchScore } from "@/lib/name-utils";

const EDIT_PASSWORD = "acab";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (req.headers.get("x-edit-password") !== EDIT_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const incident = await prisma.incident.findUnique({
    where: { id },
    select: { headline: true, summary: true, location: true },
  });

  if (!incident) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Extract person name and keywords from the new incident
  const name = extractPersonName(incident.headline ?? "");
  const headlineWords = (incident.headline ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const locationParts = (incident.location ?? "")
    .toLowerCase()
    .split(/[,\s]+/)
    .filter((w) => w.length > 2);

  // Search approved incidents for candidates
  const existing = await prisma.incident.findMany({
    where: {
      id: { not: id },
      status: "COMPLETE",
      headline: { not: null },
    },
    select: {
      id: true,
      headline: true,
      summary: true,
      date: true,
      location: true,
      approved: true,
    },
  });

  const scored = existing
    .map((e) => {
      let score = 0;

      // Name matching (highest weight)
      if (name) {
        const eName = extractPersonName(e.headline ?? "");
        if (eName) {
          const ns = nameMatchScore(name, eName);
          score += ns * 60;
        }
      }

      // Keyword overlap
      const eWords = (e.headline ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3);
      const commonWords = headlineWords.filter(
        (w) => eWords.includes(w) && !["that", "this", "with", "from", "after", "were", "they", "have", "been", "during"].includes(w)
      );
      score += commonWords.length * 5;

      // Location boost
      if (incident.location && e.location) {
        const eLocParts = e.location.toLowerCase().split(/[,\s]+/).filter((w) => w.length > 2);
        const commonLoc = locationParts.filter((l) => eLocParts.includes(l));
        score += commonLoc.length * 3;
      }

      return {
        id: e.id,
        headline: e.headline ?? "",
        date: e.date,
        location: e.location,
        score,
        approved: e.approved,
      };
    })
    .filter((c) => c.score >= 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return NextResponse.json({ candidates: scored });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (req.headers.get("x-edit-password") !== EDIT_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: idStr } = await params;
  const newId = parseInt(idStr, 10);
  if (isNaN(newId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const existingId = body.existingId;
  if (!existingId || typeof existingId !== "number") {
    return NextResponse.json({ error: "existingId required" }, { status: 400 });
  }

  // Fetch both incidents
  const incidents = await prisma.incident.findMany({
    where: { id: { in: [existingId, newId] } },
  });

  if (incidents.length < 2) {
    return NextResponse.json({ error: "Incidents not found" }, { status: 404 });
  }

  const primary = incidents.find((i) => i.id === existingId)!;
  const secondary = incidents.find((i) => i.id === newId)!;

  // Collect all URLs
  const existingAlt = parseAltSources(primary.altSources);
  const newAlt = parseAltSources(secondary.altSources);
  const allUrls = [
    primary.url,
    ...existingAlt,
    secondary.url,
    ...newAlt,
  ];
  const uniqueUrls = [...new Set(allUrls)].filter((u) => u !== primary.url);

  // Synthesize
  const { headline, summary, timeline } = await synthesizeIncidents(
    [primary, secondary].map((i) => ({
      url: i.url,
      headline: i.headline,
      summary: i.summary,
      date: i.date,
    }))
  );

  // Determine latest date for sorting
  let latestParsedDate = primary.parsedDate;
  if (timeline.length > 0) {
    const dates = timeline
      .map((e) => {
        const parts = e.date.split("/");
        if (parts.length === 3) {
          return new Date(`${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`);
        }
        return new Date(e.date);
      })
      .filter((d) => !isNaN(d.getTime()));
    if (dates.length > 0) {
      latestParsedDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    }
  }

  // Update primary with merged data
  await prisma.incident.update({
    where: { id: primary.id },
    data: {
      altSources: uniqueUrls.length > 0 ? JSON.stringify(uniqueUrls) : null,
      headline,
      summary,
      timeline: serializeTimeline(timeline),
      parsedDate: latestParsedDate,
      status: "COMPLETE",
      approved: true,
      // Keep primary's location/country/etc if secondary doesn't add new info
      location: primary.location || secondary.location,
      latitude: primary.latitude || secondary.latitude,
      longitude: primary.longitude || secondary.longitude,
      country: primary.country || secondary.country,
      incidentType: primary.incidentType || secondary.incidentType,
    },
  });

  // Delete the secondary
  await prisma.incident.delete({ where: { id: newId } });

  return NextResponse.json({ success: true, survivingId: primary.id });
}
