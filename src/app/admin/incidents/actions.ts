"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { processIncidentPipeline } from "@/lib/pipeline";
import { parseAltSources, serializeAltSources } from "@/lib/sources";
import { synthesizeIncidents } from "@/lib/extractor";

async function requireAdmin() {
  const session = await getSession();
  if (!session.isAdmin) throw new Error("Unauthorized");
}

function extractAltSourcesFromForm(formData: FormData): string | null {
  const raw = formData.getAll("altSources[]") as string[];
  return serializeAltSources(raw);
}

export async function createIncident(formData: FormData) {
  await requireAdmin();
  const url = (formData.get("url") as string)?.trim();
  if (!url) throw new Error("URL is required");

  const incident = await prisma.incident.create({
    data: {
      url,
      altSources: extractAltSourcesFromForm(formData),
      headline: (formData.get("headline") as string)?.trim() || null,
      date: (formData.get("date") as string)?.trim() || null,
      location: (formData.get("location") as string)?.trim() || null,
      summary: (formData.get("summary") as string)?.trim() || null,
      incidentType: (formData.get("incidentType") as string)?.trim() || null,
      country: (formData.get("country") as string)?.trim() || null,
      status: "RAW",
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");

  // Fire and forget — don't block the response
  processIncidentPipeline(incident.id).catch((err) => {
    console.error(`Pipeline failed for incident ${incident.id}:`, err.message);
  });

  return incident;
}

export async function updateIncident(id: number, formData: FormData) {
  await requireAdmin();

  await prisma.incident.update({
    where: { id },
    data: {
      url: (formData.get("url") as string)?.trim(),
      altSources: extractAltSourcesFromForm(formData),
      headline: (formData.get("headline") as string)?.trim() || null,
      date: (formData.get("date") as string)?.trim() || null,
      location: (formData.get("location") as string)?.trim() || null,
      summary: (formData.get("summary") as string)?.trim() || null,
      incidentType: (formData.get("incidentType") as string)?.trim() || null,
      country: (formData.get("country") as string)?.trim() || null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function deleteIncident(id: number) {
  await requireAdmin();
  await prisma.incident.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function mergeIncidents(ids: number[]) {
  await requireAdmin();
  if (ids.length < 2) throw new Error("Need at least 2 incidents to merge");

  const incidents = await prisma.incident.findMany({
    where: { id: { in: ids } },
    orderBy: { id: "asc" },
  });

  if (incidents.length < 2) throw new Error("Could not find enough incidents");

  const primary = incidents[0];
  const others = incidents.slice(1);

  // Collect all non-primary URLs (other primaries + all altSources)
  const extraUrls: string[] = [
    ...others.map((i) => i.url),
    ...incidents.flatMap((i) => parseAltSources(i.altSources)),
  ].filter((url, idx, arr) => url !== primary.url && arr.indexOf(url) === idx);

  // Synthesize headline + summary from all incidents
  const { headline, summary } = await synthesizeIncidents(
    incidents.map((i) => ({
      url: i.url,
      headline: i.headline,
      summary: i.summary,
    }))
  );

  // Pick the best metadata: first non-null value across all incidents
  const pick = <T>(fn: (i: typeof primary) => T | null): T | null =>
    incidents.reduce<T | null>((acc, inc) => (acc !== null ? acc : fn(inc)), null);

  await prisma.incident.update({
    where: { id: primary.id },
    data: {
      altSources: extraUrls.length > 0 ? JSON.stringify(extraUrls) : null,
      headline,
      summary,
      date: pick((i) => i.date),
      location: pick((i) => i.location),
      latitude: pick((i) => i.latitude),
      longitude: pick((i) => i.longitude),
      country: pick((i) => i.country),
      incidentType: pick((i) => i.incidentType),
      status: "COMPLETE",
    },
  });

  await prisma.incident.deleteMany({
    where: { id: { in: others.map((i) => i.id) } },
  });

  revalidatePath("/admin");
  revalidatePath("/");

  return { survivingId: primary.id };
}
