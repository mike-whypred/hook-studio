/**
 * Switches between making versions and analysing how they did.
 * Plain links on purpose: the studio's script only starts on a full page load.
 */
export default function StudioTabs({ current }: { current: "make" | "analyse" }) {
  return (
    <nav className="tabs" aria-label="Hook Studio">
      <a href="/studio" aria-current={current === "make" ? "page" : undefined}>
        Make versions
      </a>
      <a href="/studio/analyse" aria-current={current === "analyse" ? "page" : undefined}>
        Analyse trial reels
      </a>
    </nav>
  );
}
