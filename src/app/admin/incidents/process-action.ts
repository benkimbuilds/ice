"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { processIncidentPipeline } from "@/lib/pipeline";

export async function processIncident(id: number) {
  const session = await getSession();
  if (!session.isAdmin) throw new Error("Unauthorized");

  await processIncidentPipeline(id);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function processAllIncomplete(): Promise<string> {
  const session = await getSession();
  if (!session.isAdmin) throw new Error("Unauthorized");

  const incidents = await prisma.incident.findMany({
    where: {
      OR: [
        { status: "RAW" },
        { status: "FAILED" },
        { headline: null },
        { summary: null },
      ],
    },
    select: { id: true },
  });

  let succeeded = 0;
  let failed = 0;

  for (const inc of incidents) {
    try {
      await processIncidentPipeline(inc.id);
      succeeded++;
    } catch {
      failed++;
    }
  }

  revalidatePath("/admin");
  revalidatePath("/");

  return `Processed ${incidents.length}: ${succeeded} succeeded, ${failed} failed`;
}
