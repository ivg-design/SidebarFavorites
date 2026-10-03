import RailList from "./RailList";
import { nb } from "@/lib/nowrap";
import "@/app/rail.css";

/** The site's navigation as a light Finder sidebar. Visible from 1180px; below that the header menu takes over. */
export default function FavoritesRail({ release }: { release: { version: string } }) {
  return (
    <aside className="rail" data-testid="favorites-rail">
      <nav className="rail-in" aria-label="Page sections">
        <RailList idPrefix="rail" />
        <p className="rail-meta">{nb(`v${release.version} · macOS 13+`)}</p>
      </nav>
    </aside>
  );
}
