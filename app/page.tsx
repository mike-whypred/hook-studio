import { currentUser } from "@/lib/auth/server";
import { hasAccess } from "@/lib/billing";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  const paid = user ? await hasAccess(user.id) : false;
  const cta = !user ? { href: "/sign-in", label: "Get started" } : paid ? { href: "/studio", label: "Open the studio" } : { href: "/pricing", label: "Choose a plan" };

  return (
    <div className="wrap">
      <div className="hero">
        <h1>Hook Studio</h1>
        <p className="lead">
          Describe your video and Claude writes on-screen hooks in your tone. Pick the ones you like, choose looks, fonts and
          variation tricks, and the app makes every version of your Reel right in your browser, with a fresh caption for each.
        </p>
        <div className="card-s">
          <h3>How it works</h3>
          <ul className="ticks">
            <li>Add your video. It never leaves your browser.</li>
            <li>Pick hooks from options Claude writes, or add your own.</li>
            <li>Mix 37 text looks, 39 fonts, positions and tricks across versions.</li>
            <li>Record every version and save them all as one zip.</li>
            <li>Get a different caption for each post.</li>
          </ul>
          <a className="btn" href={cta.href} style={{ textDecoration: "none", display: "inline-block" }}>
            {cta.label}
          </a>
        </div>
      </div>
    </div>
  );
}
