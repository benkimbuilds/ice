import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./form";

export default async function LoginPage() {
  const session = await getSession();
  if (session.isAdmin) {
    redirect("/admin");
  }

  return (
    <div className="max-w-sm mx-auto mt-24">
      <h2 className="text-xl font-serif font-bold mb-6">Admin Login</h2>
      <LoginForm />
    </div>
  );
}
