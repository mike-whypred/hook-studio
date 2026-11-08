"use client";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export default function SignInForm({ initialMode }: { initialMode: "in" | "up" }) {
  const [mode, setMode] = useState(initialMode);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")), password = String(f.get("password"));
    setBusy(true);
    setErr("");
    const res =
      mode === "in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: String(f.get("name") || email.split("@")[0]) });
    setBusy(false);
    if (res.error) {
      setErr(res.error.message || "That didn't work. Check your details and try again.");
      return;
    }
    const next = new URLSearchParams(location.search).get("next");
    location.href = next && next.startsWith("/") ? next : "/studio";
  }

  return (
    <div className="wrap narrow" style={{ marginTop: 40 }}>
      <h1><Link href="/">Hook Studio</Link></h1>
      <p className="lead">{mode === "in" ? "Sign in to your account." : "Create your account."}</p>
      <form className="card-s" onSubmit={submit}>
        {mode === "up" && (
          <label className="field">
            <span>Name</span>
            <input type="text" name="name" autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" name="email" required autoComplete="email" />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" name="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} />
        </label>
        <button className="btn" disabled={busy} style={{ width: "100%" }}>
          {busy ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
        {err && <p className="note err" role="alert">{err}</p>}
      </form>
      <p className="note">
        {mode === "in" ? "New here? " : "Already have an account? "}
        <button className="linkbtn" onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(""); }}>
          {mode === "in" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
