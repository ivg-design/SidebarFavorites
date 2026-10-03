// OWNER: worker B. id="install". Uses <CopyButton/> from ./CopyButton (worker D).
import type { SiteRelease } from "@/lib/github";
export default function Install({ release }: { release: SiteRelease }) {
  return <section id="install" className="install"><a href={release.dmgUrl}>Download {release.version}</a></section>;
}
