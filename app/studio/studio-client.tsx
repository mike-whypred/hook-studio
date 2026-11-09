"use client";
import Script from "next/script";
import SignOutButton from "../sign-out-button";
import { STUDIO_MARKUP } from "./markup";

/** The original Hook Studio page, unchanged, driven by public/hook-studio.js. */
export default function StudioClient({
  email,
  showBilling,
  billingError,
}: {
  email: string;
  showBilling: boolean;
  billingError: boolean;
}) {
  return (
    <>
      <div className="topbar">
        <span className="who">{email}</span>
        <span className="row" style={{ gap: 8 }}>
          {showBilling && (
            <form action="/api/portal" method="post">
              <button className="btn ghost">Billing</button>
            </form>
          )}
          <SignOutButton />
        </span>
        {billingError && (
          <p className="note err" role="alert" style={{ flexBasis: "100%", margin: 0 }}>
            Billing couldn&apos;t be opened just now. Please try again in a minute.
          </p>
        )}
      </div>
      <div dangerouslySetInnerHTML={{ __html: STUDIO_MARKUP }} />
      <Script src="/hook-studio.js" strategy="afterInteractive" />
    </>
  );
}
