"use client";

import { logout } from "./actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="text-sm text-warm-500 hover:text-warm-900 underline"
      >
        Log out
      </button>
    </form>
  );
}
