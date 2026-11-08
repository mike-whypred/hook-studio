"use client";
import Script from "next/script";
import { authClient } from "@/lib/auth/client";
import { STUDIO_MARKUP } from "./markup";

/** The original Hook Studio page, unchanged, driven by public/hook-studio.js. */
export default function StudioClient({ email }: { email: string }) {
  async function signOut() {
    await authClient.signOut();
    location.href = "/";
  }

  return (
    <>
      <div className="topbar">
        <span className="who">{email}</span>
        <span className="row" style={{ gap: 8 }}>
          <form action="/api/portal" method="post">
            <button className="btn ghost">Billing</button>
          </form>
          <button className="btn ghost" onClick={signOut}>Sign out</button>
        </span>
      </div>
      <div dangerouslySetInnerHTML={{ __html: STUDIO_MARKUP }} />
      <Script src="/hook-studio.js" strategy="afterInteractive" />
    </>
  );
}
