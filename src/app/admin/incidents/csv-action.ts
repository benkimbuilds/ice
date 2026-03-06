"use server";

import { getSession } from "@/lib/session";

export async function uploadCsv(formData: FormData): Promise<string> {
  const session = await getSession();
  if (!session.isAdmin) throw new Error("Unauthorized");

  // TODO: Will be implemented in Task 9
  throw new Error("CSV upload not yet implemented");
}
