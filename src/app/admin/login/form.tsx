"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [error, formAction, isPending] = useActionState(login, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-warm-700 mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full px-4 py-2.5 border border-warm-300 bg-white focus:outline-none focus:border-warm-900"
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2.5 bg-warm-900 text-white font-medium hover:bg-warm-800 disabled:opacity-50 transition-colors"
      >
        {isPending ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
