import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scrapeUrl } from "@/lib/scraper";
import { extractFromText } from "@/lib/extractor";
import { synthesizeIncidents } from "@/lib/extractor";
import { serializeTimeline } from "@/lib/extractor";
import { parseAltSources } from "@/lib/sources";

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

  // Collect all URLs: primary + alt sources
  const altUrls = parseAltSources(incident.altSources);
  const allUrls = [incident.url, ...altUrls];

  // Scrape and extract from each source
  const sources: Array<{
    url: string;
    headline: string | null;
    summary: string | null;
    date: string | null;
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
      });
    } catch {
      // Skip sources that fail to scrape
    }
  }

  if (sources.length === 0) {
    return NextResponse.json(
      { error: "Could not scrape any sources" },
      { status: 500 }
    );
  }

  // If only one source, use its extraction directly
  if (sources.length === 1) {
    const s = sources[0];
    await prisma.incident.update({
      where: { id },
      data: {
        headline: s.headline || incident.headline,
        summary: s.summary || incident.summary,
      },
    });
    return NextResponse.json({ success: true, sourcesUsed: 1 });
  }

  // Multiple sources: synthesize
  const result = await synthesizeIncidents(sources);

  await prisma.incident.update({
    where: { id },
    data: {
      headline: result.headline,
      summary: result.summary,
      timeline: serializeTimeline(result.timeline),
    },
  });

  return NextResponse.json({ success: true, sourcesUsed: sources.length });
}
