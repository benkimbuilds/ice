import { prisma } from "./db";
import { scrapeUrl } from "./scraper";
import { extractFromText } from "./extractor";

export async function processIncidentPipeline(incidentId: number) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
  });

  if (!incident) throw new Error("Incident not found");

  await prisma.incident.update({
    where: { id: incidentId },
    data: { status: "PROCESSING", errorMessage: null },
  });

  try {
    const text = await scrapeUrl(incident.url);

    const extracted = await extractFromText(text, incident.url);

    await prisma.incident.update({
      where: { id: incidentId },
      data: {
        rawHtml: text.slice(0, 50000),
        headline: incident.headline || extracted.headline,
        date: incident.date || extracted.date,
        location: incident.location || extracted.location,
        summary: incident.summary || extracted.summary,
        incidentType: incident.incidentType || extracted.incidentType,
        country: incident.country || extracted.country,
        status: "COMPLETE",
        errorMessage: null,
      },
    });
  } catch (error: any) {
    await prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: "FAILED",
        errorMessage: error.message?.slice(0, 500) || "Unknown error",
      },
    });
    throw error;
  }
}
