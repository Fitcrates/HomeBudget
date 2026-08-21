"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      className="px-4 py-2 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm text-orange-800 dark:text-white/80 border border-orange-200/50 dark:border-white/10 font-medium hover:bg-white dark:hover:bg-white/10 hover:border-orange-500/60 dark:hover:border-indigo-400/60 transition-colors duration-700 shadow-sm hover:shadow"
      onClick={() => void signOut()}
    >
      Sign out
    </button>
  );
}
