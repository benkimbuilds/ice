import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scrapeUrl } from "@/lib/scraper";
import { extractFromText, synthesizeIncidentsWithMismatchDetection, synthesizeIncidents, serializeTimeline } from "@/lib/extractor";
import { parseAltSources } from "@/lib/sources";
import { parseIncidentDate } from "@/lib/geocode";

const EDIT_PASSWORD = "acab";

export async function POST(
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

  const incident = await prisma.incident.findUnique({ where: { id } });
  if (!incident) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Collect all URLs
  const altUrls = parseAltSources(incident.altSources);
  const allUrls = [incident.url, ...altUrls];

  if (allUrls.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 sources to split" },
      { status: 400 }
    );
  }

  // Scrape and extract from each source individually
  const sources: Array<{
    url: string;
    headline: string | null;
    summary: string | null;
    date: string | null;
    location?: string | null;
    incidentType?: string | null;
    country?: string | null;
  }> = [];

  for (const url of allUrls) {
    try {
      const { metadata, bodyText } = await scrapeUrl(url);
      const extracted = await extractFromText(bodyText, url, metadata);
      sources.push({
        url,
        headline: extracted.headline,
        summary: extracted.summary,
        date: extracted.date,
        location: extracted.location,
        incidentType: extracted.incidentType,
        country: extracted.country,
      });
    } catch {
      // If scrape fails, include with minimal info
      sources.push({
        url,
        headline: null,
        summary: null,
        date: null,
      });
    }
  }

  // Use mismatch detection to find natural groupings
  const scrapedSources = sources.filter(s => s.headline || s.summary);
  if (scrapedSources.length < 2) {
    return NextResponse.json(
      { error: "Could not scrape enough sources to analyze for splitting" },
      { status: 500 }
    );
  }

  const result = await synthesizeIncidentsWithMismatchDetection(scrapedSources);

  if (!result.mismatch) {
    return NextResponse.json(
      { error: "All sources appear to describe the same incident. No split needed." },
      { status: 409 }
    );
  }

  // We have groups! Split them.
  const groups = result.groups;
  if (groups.length < 2) {
    return NextResponse.json(
      { error: "Mismatch detected but only one group found" },
      { status: 500 }
    );
  }

  const createdIds: number[] = [];

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const groupSources = group.sourceIndices.map(i => scrapedSources[i]).filter(Boolean);
    if (groupSources.length === 0) continue;

    const groupUrls = groupSources.map(s => s.url);
    const primaryUrl = groupUrls[0];
    const altGroupUrls = groupUrls.slice(1);

    // Synthesize this group's sources
    let headline: string;
    let summary: string;
    let timeline: Array<{ date: string; event: string; source?: string }> = [];

    if (groupSources.length === 1) {
      headline = groupSources[0].headline || group.headline || "Untitled";
      summary = groupSources[0].summary || "";
    } else {
      try {
        const synth = await synthesizeIncidents(groupSources);
        headline = synth.headline;
        summary = synth.summary;
        timeline = synth.timeline;
      } catch {
        headline = group.headline || groupSources[0].headline || "Untitled";
        summary = groupSources.map(s => s.summary).filter(Boolean).join(" ");
      }
    }

    // Pick best date and location from this group's sources
    const dates = groupSources.map(s => s.date).filter(Boolean) as string[];
    const bestDate = dates[0] || incident.date;
    const parsedDate = parseIncidentDate(bestDate);
    const location = groupSources.find(s => s.location)?.location || incident.location;
    const country = groupSources.find(s => s.country)?.country || incident.country;
    const incidentType = groupSources.find(s => s.incidentType)?.incidentType || incident.incidentType;

    if (gi === 0) {
      // Update original incident with first group
      await prisma.incident.update({
        where: { id },
        data: {
          url: primaryUrl,
          altSources: altGroupUrls.length > 0 ? JSON.stringify(altGroupUrls) : null,
          headline,
          summary,
          date: bestDate,
          parsedDate,
          timeline: serializeTimeline(timeline),
          location,
          country,
          incidentType,
        },
      });
    } else {
      // Create new incident for additional groups
      try {
        const newIncident = await prisma.incident.create({
          data: {
            url: primaryUrl,
            altSources: altGroupUrls.length > 0 ? JSON.stringify(altGroupUrls) : null,
            headline,
            summary,
            date: bestDate,
            parsedDate,
            timeline: serializeTimeline(timeline),
            location,
            country,
            incidentType,
            status: "COMPLETE",
            approved: false, // Goes to pending review
            latitude: incident.latitude,
            longitude: incident.longitude,
          },
        });
        createdIds.push(newIncident.id);
      } catch (e: any) {
        // URL uniqueness conflict — skip
        console.error(`Split: could not create incident for ${primaryUrl}:`, e.message);
      }
    }
  }

  return NextResponse.json({
    success: true,
    groups: groups.length,
    createdIds,
  });
}
