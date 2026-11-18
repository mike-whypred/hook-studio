"use client";
import { useCallback, useEffect, useState } from "react";
import type { Brand, Reel } from "@/lib/metricool";
import type { Recommendation } from "@/lib/reel-analysis";
import type { Bench, BenchReel } from "@/lib/reel-bench";
import SignOutButton from "../../sign-out-button";
import StudioTabs from "../tabs";
import "./analyse.css";

type Conn = { configured: boolean; connected: boolean; mcUserId?: string; brand?: { id: string; label: string } | null; brands?: Brand[] };
type Rec = { result: Recommendation; at: string; newSince: string[] };
type GroupView = { id: number; label: string; bench: Bench; rec: Rec | null };
type Data = {
  brand: { label: string; timezone: string };
  days: number;
  total: number;
  groups: GroupView[];
  allGroups: { id: number; label: string }[];
  ungrouped: Reel[];
  hidden: Reel[];
  grouping: "ok" | "failed" | "rate_limited";
};

const RANGES: [number, string][] = [
  [7, "Last 7 days"],
  [30, "Last 30 days"],
  [90, "Last 3 months"],
];
const ERRORS: Record<string, string> = {
  bad_token: "Metricool didn't accept that token. Check it and your user ID, then try again.",
  bad_input: "Check the user ID (numbers only) and the token.",
  not_configured: "The Analyse tab isn't switched on for this site yet.",
  unavailable: "Metricool couldn't be reached. Try again in a minute.",
  rate_limited: "You've reached today's limit for Claude. Try again tomorrow.",
  ai_failed: "Claude couldn't write advice for this one. Try again.",
  no_reels: "None of these reels are in the last 3 months, so there's nothing to analyse.",
};
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
/** 2.4 -> "2.4x", 0.31 -> "31% of", 0.0008 -> "0.1% of" */
const ratio = (r: number) => (r >= 1 ? (r >= 10 ? "10x+" : r.toFixed(1) + "x") : (r * 100 < 1 ? Math.max(0.1, r * 100).toFixed(1) : Math.round(r * 100)) + "% of");
const fmtDate = (s: string) =>
  s ? new Date(s + "Z").toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" }) : "";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
  if (res.status === 401) location.href = "/sign-in?next=/studio/analyse";
  if (res.status === 402) location.href = "/pricing";
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "failed");
  return body as T;
}
const said = (e: unknown) => ERRORS[(e as Error).message] ?? "Something went wrong. Try again.";

export default function AnalyseClient({ email, showBilling }: { email: string; showBilling: boolean }) {
  const [conn, setConn] = useState<Conn | null>(null);
  const [days, setDays] = useState(() => {
    try {
      const d = Number(typeof window === "undefined" ? 0 : localStorage.getItem("hookstudio.analyse.days"));
      return [7, 30, 90].includes(d) ? d : 30;
    } catch {
      return 30;
    }
  });
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError("");
    try {
      setData(await api<Data>(`/api/analyse/reels?days=${d}`));
    } catch (e) {
      setError(said(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api<Conn>("/api/metricool")
      .then((c) => {
        setConn(c);
        if (c.connected && c.brand) load(days);
      })
      .catch((e) => {
        setConn({ configured: true, connected: false });
        setError(said(e));
      });
    // Runs once on arrival; later loads come from the controls below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickBrand = (brand: { id: string; label: string }) => {
    setConn((c) => (c ? { ...c, brand } : c));
    setData(null);
    load(days);
  };
  const pickDays = (d: number) => {
    setDays(d);
    load(d);
    try {
      localStorage.setItem("hookstudio.analyse.days", String(d));
    } catch {}
  };

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
      </div>
      <div className="wrap">
        <StudioTabs current="analyse" />
        <h1>Hook Studio</h1>
        {error && (
          <p className="note err" role="alert">
            {error}
          </p>
        )}
        {!conn ? (
          <p className="note">Loading…</p>
        ) : !conn.configured ? (
          <div className="card-s">
            <p className="lead">The Analyse tab isn&apos;t switched on for this site yet.</p>
          </div>
        ) : !conn.connected ? (
          <Connect
            onDone={(c) => {
              setConn(c);
              if (c.brand) load(days);
            }}
            onError={setError}
          />
        ) : !conn.brand ? (
          <BrandPicker conn={conn} onPick={pickBrand} onError={setError} />
        ) : (
          <>
            <div className="card-s">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <h2 className="t">Trial reels for {conn.brand.label}</h2>
                  <p className="lead" style={{ margin: 0 }}>
                    Versions of the same video are grouped together. Compare them, get advice, then remake the next round.
                  </p>
                </div>
                <BrandSwitch conn={conn} onPick={pickBrand} onDisconnect={() => setConn({ configured: true, connected: false })} onError={setError} />
              </div>
              <div className="chips" style={{ marginTop: 14 }} role="group" aria-label="Date range">
                {RANGES.map(([d, l]) => (
                  <button key={d} className="chip" aria-pressed={days === d} onClick={() => pickDays(d)}>
                    {l}
                  </button>
                ))}
                <button className="chip" onClick={() => load(days)} disabled={loading}>
                  Refresh
                </button>
              </div>
              <p className="note">
                Instagram doesn&apos;t tell Metricool which reels were trials, so every reel shows. Hide the ones that aren&apos;t.
              </p>
            </div>
            {loading && !data && <p className="note thinking">Reading your reels and grouping them by video… this can take a minute the first time.</p>}
            {data && <Results data={data} loading={loading} reload={() => load(days)} setData={setData} onError={setError} />}
          </>
        )}
      </div>
    </>
  );
}

function Connect({ onDone, onError }: { onDone: (c: Conn) => void; onError: (s: string) => void }) {
  const [mcUserId, setId] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    onError("");
    try {
      const r = await api<{ brands: Brand[]; brand: Brand | null }>("/api/metricool", { method: "POST", body: JSON.stringify({ mcUserId, token }) });
      onDone({ configured: true, connected: true, mcUserId, brands: r.brands, brand: r.brand });
    } catch (err) {
      onError(said(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="card-s" onSubmit={submit}>
      <h2 className="t">Connect Metricool</h2>
      <p className="lead">
        Hook Studio reads your Instagram reel stats from Metricool to compare your trial reels. In Metricool, open your account settings and find the API
        section for your user ID and API token.
      </p>
      <label className="field">
        Metricool user ID
        <input type="text" inputMode="numeric" value={mcUserId} onChange={(e) => setId(e.target.value.trim())} required />
      </label>
      <label className="field">
        API token
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" required />
      </label>
      <p className="note">The token is stored encrypted and only used to read your stats. Disconnecting deletes it.</p>
      <div className="actions">
        <span></span>
        <button className="btn" disabled={busy || !mcUserId || !token}>
          {busy ? "Checking…" : "Connect"}
        </button>
      </div>
    </form>
  );
}

function BrandPicker({ conn, onPick, onError }: { conn: Conn; onPick: (b: { id: string; label: string }) => void; onError: (s: string) => void }) {
  const brands = conn.brands ?? [];
  const pick = async (b: Brand) => {
    try {
      await api("/api/metricool", { method: "PUT", body: JSON.stringify({ blogId: b.id }) });
      onPick({ id: b.id, label: b.label });
    } catch (e) {
      onError(said(e));
    }
  };
  return (
    <div className="card-s">
      <h2 className="t">Which brand?</h2>
      {brands.length ? (
        <div className="chips">
          {brands.map((b) => (
            <button key={b.id} className="chip" onClick={() => pick(b)}>
              {b.label} · @{b.instagram}
            </button>
          ))}
        </div>
      ) : (
        <p className="lead">None of your Metricool brands has Instagram connected.</p>
      )}
    </div>
  );
}

function BrandSwitch({ conn, onPick, onDisconnect, onError }: { conn: Conn; onPick: (b: { id: string; label: string }) => void; onDisconnect: () => void; onError: (s: string) => void }) {
  const change = async (id: string) => {
    if (id === "__disconnect") {
      await api("/api/metricool", { method: "DELETE" }).catch(() => 0);
      return onDisconnect();
    }
    try {
      await api("/api/metricool", { method: "PUT", body: JSON.stringify({ blogId: id }) });
      onPick({ id, label: conn.brands?.find((b) => b.id === id)?.label ?? id });
    } catch (e) {
      onError(said(e));
    }
  };
  return (
    <select className="pick" value={conn.brand?.id} onChange={(e) => change(e.target.value)} aria-label="Brand">
      {(conn.brands ?? []).map((b) => (
        <option key={b.id} value={b.id}>
          {b.label}
        </option>
      ))}
      <option value="__disconnect">Disconnect Metricool</option>
    </select>
  );
}

type ResultsProps = { data: Data; loading: boolean; reload: () => void; setData: (d: Data) => void; onError: (s: string) => void };

function Results({ data, loading, reload, setData, onError }: ResultsProps) {
  const [showHidden, setShowHidden] = useState(false);
  const move = async (reelId: string, to: string) => {
    const body =
      to === "__hide"
        ? { action: "hide", reelId, hidden: true }
        : to === "__new"
          ? { action: "move", reelId, newLabel: prompt("Name the video, e.g. \"Golf range, black skirt\"") || "" }
          : { action: "move", reelId, groupId: Number(to) };
    if (to === "__new" && !body.newLabel) return;
    try {
      await api("/api/analyse/groups", { method: "POST", body: JSON.stringify(body) });
      reload();
    } catch (e) {
      onError(said(e));
    }
  };
  const unhide = async (reelId: string) => {
    await api("/api/analyse/groups", { method: "POST", body: JSON.stringify({ action: "hide", reelId, hidden: false }) }).catch(() => 0);
    reload();
  };
  const setRec = (groupId: number, rec: Rec) => setData({ ...data, groups: data.groups.map((g) => (g.id === groupId ? { ...g, rec } : g)) });

  return (
    <div style={{ opacity: loading ? 0.6 : 1 }}>
      {data.grouping === "failed" && <p className="note err">Some new reels couldn&apos;t be grouped this time. Press Refresh to try again, or sort them below.</p>}
      {data.grouping === "rate_limited" && <p className="note err">{ERRORS.rate_limited} New reels are listed below until then.</p>}
      {!data.total && <p className="note">No reels in this period.</p>}
      {data.groups.map((g) => (
        <GroupCard key={g.id} g={g} groups={data.allGroups} move={move} setRec={setRec} onError={onError} />
      ))}
      {data.ungrouped.length > 0 && (
        <div className="card-s">
          <h3>Not grouped yet</h3>
          <div className="reels">
            {data.ungrouped.map((r) => (
              <ReelTile key={r.id} r={r} groups={data.allGroups} groupId={null} move={move} />
            ))}
          </div>
        </div>
      )}
      {data.hidden.length > 0 && (
        <p className="note">
          <button className="linkbtn" onClick={() => setShowHidden(!showHidden)}>
            {showHidden ? "Hide" : "Show"} {data.hidden.length} hidden reel{data.hidden.length > 1 ? "s" : ""}
          </button>
        </p>
      )}
      {showHidden && (
        <div className="reels">
          {data.hidden.map((r) => (
            <div key={r.id} className="reel">
              <Thumb r={r} />
              <button className="btn ghost small" onClick={() => unhide(r.id)}>
                Unhide
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Move = (reelId: string, to: string) => void;

function GroupCard({ g, groups, move, setRec, onError }: { g: GroupView; groups: Data["allGroups"]; move: Move; setRec: (id: number, r: Rec) => void; onError: (s: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState(g.label);
  const b = g.bench;
  const notes = new Map((g.rec?.result.verdicts ?? []).map((v) => [v.reel, v.note]));
  const advise = async () => {
    setBusy(true);
    onError("");
    try {
      setRec(g.id, await api<Rec>("/api/analyse/recommend", { method: "POST", body: JSON.stringify({ groupId: g.id }) }));
    } catch (e) {
      onError(said(e));
    } finally {
      setBusy(false);
    }
  };
  const rename = async () => {
    const v = label.trim();
    if (!v || v === g.label) return setLabel(g.label);
    await api("/api/analyse/groups", { method: "POST", body: JSON.stringify({ action: "rename", groupId: g.id, label: v }) }).catch(() => setLabel(g.label));
  };
  const latest = b.latest;
  return (
    <section className="card-s group">
      <header className="ghead">
        <input type="text" className="glabel" value={label} onChange={(e) => setLabel(e.target.value)} onBlur={rename} aria-label="Video name" />
        <span className="note" style={{ margin: 0 }}>
          {b.reels.length} version{b.reels.length > 1 ? "s" : ""} · best {compact.format(b.bestViews)} views
          {b.heldBackCount > 0 && <span className="pill warn">{b.heldBackCount} likely held back as duplicates</span>}
        </span>
      </header>
      {latest && latest.viewsVsBest !== null && (
        <p className="bench">
          Latest version: <strong>{ratio(latest.viewsVsBest)}</strong> the views of the best earlier one
          {latest.skipVsBest !== null && (
            <>
              , skip rate <strong>{latest.skipVsBest > 0 ? "+" : ""}{latest.skipVsBest.toFixed(1)} pts</strong>
            </>
          )}
          .
        </p>
      )}
      <div className="reels">
        {[...b.reels].reverse().map((r) => (
          <ReelTile key={r.id} r={r} groups={groups} groupId={g.id} move={move} note={notes.get(r.id)} isNew={!!g.rec?.newSince.includes(r.id)} />
        ))}
      </div>
      <Advice g={g} busy={busy} advise={advise} />
    </section>
  );
}

function Thumb({ r }: { r: Reel }) {
  return (
    <a className="thumb" href={r.url} target="_blank" rel="noreferrer" aria-label="Open on Instagram">
      {/* eslint-disable-next-line @next/next/no-img-element -- Instagram cover URLs; next/image would need every CDN host configured */}
      {r.thumb ? <img src={r.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span>No cover</span>}
    </a>
  );
}

function ReelTile({ r, groups, groupId, move, note, isNew }: { r: Reel | BenchReel; groups: Data["allGroups"]; groupId: number | null; move: Move; note?: string; isNew?: boolean }) {
  const br = r as Partial<BenchReel>;
  return (
    <div className="reel">
      <Thumb r={r} />
      <div className="badges">
        {br.best && <span className="pill ok">Best</span>}
        {br.heldBack && <span className="pill warn">Held back?</span>}
        {br.tooNew && <span className="pill">Under a day old</span>}
        {isNew && <span className="pill">New since advice</span>}
      </div>
      <div className="stats">
        <strong>{compact.format(r.views)}</strong> views · {fmtDate(r.postedAt)}
        <br />
        Skip {r.skipRate === null ? "n/a" : r.skipRate.toFixed(0) + "%"} · watch {r.avgWatch === null ? "n/a" : r.avgWatch.toFixed(1) + "s"}
        <br />
        {r.shares} shares · {r.saves} saves
      </div>
      {note && <p className="vnote">{note}</p>}
      <select className="pick small" value="" onChange={(e) => move(r.id, e.target.value)} aria-label="Move this reel">
        <option value="">Move…</option>
        {groups
          .filter((x) => x.id !== groupId)
          .map((x) => (
            <option key={x.id} value={x.id}>
              To: {x.label}
            </option>
          ))}
        <option value="__new">To a new video…</option>
        <option value="__hide">Hide (not a trial reel)</option>
      </select>
    </div>
  );
}

const NEXT: Record<Recommendation["next"], string> = {
  remake: "Remake it in Hook Studio",
  edit_yourself: "Edit it yourself, then remake",
  reshoot: "Film it again",
  leave_it: "Leave it for now",
};

function Advice({ g, busy, advise }: { g: GroupView; busy: boolean; advise: () => void }) {
  const rec = g.rec?.result;
  const remake = () => {
    if (!rec?.remake) return;
    try {
      localStorage.setItem(
        "hookstudio.remake",
        JSON.stringify({ label: g.label, description: rec.remake.description, hooks: rec.remake.hooks, avoid: rec.remake.avoid, notes: rec.remake.studioNotes, at: Date.now() }),
      );
    } catch {}
    // A full page load on purpose: the studio's script only starts on one.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.href = "/studio";
  };
  return (
    <div className="advice">
      {rec ? (
        <>
          <h3>
            Advice: {NEXT[rec.next]}
            <span className="note" style={{ marginLeft: 8, textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
              {new Date(g.rec!.at).toLocaleDateString("en", { day: "numeric", month: "short" })}
            </span>
          </h3>
          {g.rec!.newSince.length > 0 && (
            <p className="note warnline">
              {g.rec!.newSince.length} version{g.rec!.newSince.length > 1 ? "s were" : " was"} posted after this advice. Refresh it to benchmark the new one.
            </p>
          )}
          <p>{rec.summary}</p>
          {rec.changes.length > 0 && (
            <ul className="changes">
              {rec.changes.map((c, i) => (
                <li key={i}>
                  <strong>{c.change}</strong> <span className="note">{c.why}</span>
                </li>
              ))}
            </ul>
          )}
          {rec.manualSteps.length > 0 && (
            <>
              <h4>Do these yourself first</h4>
              <ol className="changes">
                {rec.manualSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <p className="note">When you&apos;ve reposted it, come back and press Refresh. The new version is benchmarked against these ones.</p>
            </>
          )}
          {rec.remake && rec.remake.hooks.length > 0 && (
            <>
              <h4>New hooks to try</h4>
              <ul className="hooklist">
                {rec.remake.hooks.map((h, i) => (
                  <li key={i}>{h.replace(/\\n|\n/g, " / ")}</li>
                ))}
              </ul>
              {rec.remake.studioNotes.length > 0 && <h4>Settings for the remake</h4>}
              {rec.remake.studioNotes.length > 0 && (
                <ul className="changes">
                  {rec.remake.studioNotes.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      ) : (
        <p className="note" style={{ marginTop: 0 }}>
          Claude compares these versions and suggests what to change before the next round.
        </p>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button className={rec ? "btn ghost" : "btn"} onClick={advise} disabled={busy}>
          {busy ? "Reading the numbers…" : rec ? "Refresh advice" : "Get advice"}
        </button>
        {rec?.remake && rec.remake.hooks.length > 0 && (
          <button className="btn" onClick={remake}>
            Remake in Hook Studio
          </button>
        )}
      </div>
    </div>
  );
}
