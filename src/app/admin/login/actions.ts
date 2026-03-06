"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export async function login(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const password = formData.get("password") as string;

  if (password !== process.env.ADMIN_PASSWORD) {
    return "Invalid password.";
  }

  const session = await getSession();
  session.isAdmin = true;
  await session.save();

  redirect("/admin");
}
