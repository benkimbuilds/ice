"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { processIncidentPipeline } from "@/lib/pipeline";

export async function processIncident(id: number) {
  const session = await getSession();
  if (!session.isAdmin) throw new Error("Unauthorized");

  await processIncidentPipeline(id);
  revalidatePath("/admin");
  revalidatePath("/");
}
