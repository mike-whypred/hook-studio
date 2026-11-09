"use client";
import { authClient } from "@/lib/auth/client";

export default function SignOutButton({ className = "btn ghost", label = "Sign out" }: { className?: string; label?: string }) {
  async function signOut() {
    await authClient.signOut();
    location.href = "/";
  }
  return (
    <button type="button" className={className} onClick={signOut}>
      {label}
    </button>
  );
}
