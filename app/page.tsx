import Link from "next/link";
import { currentUser } from "@/lib/auth/server";
import { hasAccess } from "@/lib/billing";
import "./landing.css";

export const dynamic = "force-dynamic";

const PRICE = process.env.PLAN_PRICE_LABEL ?? "$19";

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp-phone" aria-hidden="true">
      <div className="lp-screen">
        {children}
        <div className="lp-ui"><i /><i /><i /></div>
        <div className="lp-user">yourhandle</div>
      </div>
    </div>
  );
}

function Hook({ look, lines }: { look: string; lines: string[] }) {
  return (
    <div className={`lp-hook look-${look}`}>
      {lines.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </div>
  );
}

const FAQ = [
  ["Do my videos get uploaded?", "No. Your video is previewed and recorded in your browser and saved straight to your computer. Only the description you type is sent to Claude to write hooks and captions."],
  ["What do I get at the end?", "One video file per version, with the hook burned in, plus a different caption for each post. Save them one by one or as a single zip."],
  ["Does it work for TikTok too?", "Yes. Versions are 9:16 and the text stays clear of the areas Instagram and TikTok cover with buttons. The safe zone is shown while you edit."],
  ["Can I write my own hooks?", "Yes. Add your own lines alongside Claude's, edit any line before you approve it, and give feedback to get a new batch."],
  ["Can I cancel?", "Any time, from Billing in the studio. You keep access until the end of the period you paid for."],
];

export default async function Home() {
  const user = await currentUser();
  const paid = user ? await hasAccess(user.id) : false;
  const start = !user ? "/sign-in?mode=up&next=/pricing" : paid ? "/studio" : "/pricing";
  const startLabel = paid ? "Open the studio" : "Start making versions";

  return (
    <div className="lp">
      <header className="lp-nav">
        <Link className="lp-mark" href="/">Hook Studio</Link>
        <nav aria-label="Main">
          <Link href="#pricing">Pricing</Link>
          {user ? null : <Link href="/sign-in">Sign in</Link>}
          <a className="btn" href={start}>{paid ? "Open studio" : "Get started"}</a>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <div>
            <h1>One video, ten different openings.</h1>
            <p>
              Hook Studio writes the on-screen text for your Reel, gives every version its own look, and records them all in your
              browser. Post them as trial reels and keep the one that stops the scroll.
            </p>
            <div className="lp-cta">
              <a className="btn" href={start}>{startLabel}</a>
              <small>{PRICE} a month. Cancel any time.</small>
            </div>
          </div>

          <div className="lp-phones">
            <Screen>
              <Hook look="anton" lines={["wait for", "the lights"]} />
            </Screen>
            <Screen>
              <div className="lp-cycle">
                <Hook look="clean" lines={["never seen new york", "from up here"]} />
                <Hook look="caveat" lines={["pov: you finally", "booked the night flight"]} />
                <Hook look="type" lines={["the city at 9pm", "vs the city at 2am"]} />
              </div>
            </Screen>
            <Screen>
              <Hook look="type" lines={["book it a week", "before you land"]} />
            </Screen>
          </div>
        </section>

        <section className="lp-section" aria-labelledby="how">
          <h2 id="how">From one clip to a batch of posts</h2>
          <p>The same four steps every time. Most videos take a few minutes from upload to download.</p>
          <ol className="lp-steps">
            <li>
              <h3>Describe the video</h3>
              <p>Add the clip, say what happens in it, and pick the kind of text and tone you want.</p>
            </li>
            <li>
              <h3>Pick your hooks</h3>
              <p>Claude writes ten options at a time. Tap the ones you like, edit them, or ask for another batch.</p>
            </li>
            <li>
              <h3>Mix the looks</h3>
              <p>Choose from 37 text looks and 39 fonts, plus positions, speed, zoom and mirroring. No two versions match.</p>
            </li>
            <li>
              <h3>Record and caption</h3>
              <p>Every version records in your browser. Then get a different caption for each one, keyword included.</p>
            </li>
          </ol>
        </section>

        <section className="lp-section" aria-labelledby="why">
          <h2 id="why">Built for testing, not just editing</h2>
          <p>Trial reels show your post to people who don&rsquo;t follow you yet. Hook Studio gives you enough real variety to learn what works.</p>
          <div className="lp-facts">
            <div>
              <h3>Hooks that leave a gap</h3>
              <p>Reaction lines, specific payoffs and comparisons, written to make a stranger stay for the answer. Tell it what&rsquo;s off and it rewrites.</p>
            </div>
            <div>
              <h3>Your footage stays put</h3>
              <p>Previewing, recording and zipping all happen on your computer. Nothing you film is uploaded to us.</p>
            </div>
            <div>
              <h3>Change it in plain words</h3>
              <p>&ldquo;Text lower on version 2, no mirror, open on a different clip.&rdquo; Type it and the versions are remade.</p>
            </div>
          </div>
        </section>

        <section className="lp-section" id="pricing" aria-labelledby="price">
          <div className="lp-price">
            <div>
              <h2 id="price">One plan with everything in it</h2>
              <p style={{ color: "var(--muted)", fontSize: 17, maxWidth: "44ch" }}>
                No credits to count and no watermark. Make as many videos and versions as you post.
              </p>
            </div>
            <div className="lp-plan">
              <h3>Creator</h3>
              <p className="lp-amount">{PRICE} <small>/ month</small></p>
              <ul>
                <li>Unlimited videos and versions</li>
                <li>Hooks, revisions and captions by Claude</li>
                <li>All 37 looks and 39 fonts</li>
                <li>Download every version as one zip</li>
              </ul>
              <a className="btn" href={start}>{paid ? "Open the studio" : "Subscribe"}</a>
            </div>
          </div>
        </section>

        <section className="lp-section" aria-labelledby="faq">
          <h2 id="faq">Questions</h2>
          <div className="lp-faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-end">
          <h2>Your next post deserves more than one first line.</h2>
          <a className="btn" href={start} style={{ padding: "14px 24px", fontSize: 16 }}>{startLabel}</a>
        </section>
      </main>

      <footer className="lp-foot">
        <span>© {new Date().getFullYear()} Hook Studio</span>
        <span>Hooks and captions written with Claude</span>
      </footer>
    </div>
  );
}
