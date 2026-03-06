"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";

export async function processIncident(id: number) {
  const session = await getSession();
  if (!session.isAdmin) throw new Error("Unauthorized");

  // TODO: Will be implemented in Task 8 (scraping pipeline)
  throw new Error("Scraping pipeline not yet implemented");
}
