// OWNER: worker A. Props contract: release (version + dmgUrl) from getSiteRelease().
import type { SiteRelease } from "@/lib/github";
export default function Hero({ release }: { release: SiteRelease }) {
  return <section className="hero"><div className="wrap"><h1 className="display">Your sidebar, finally legible.</h1><a href={release.dmgUrl}>Download</a></div></section>;
}
