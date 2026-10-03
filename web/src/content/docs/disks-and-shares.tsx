import type { DocMeta } from "./types";
import { H2 } from "@/components/docs/Headings";

export const meta: DocMeta = {
  slug: "disks-and-shares",
  title: "Disks and network shares",
  group: "Guides",
  description: "Give a mounted disk or server its own icon, either as a Favorites row or by icon-ing the row Finder already shows under Locations.",
  keywords: ["disk", "volume", "network share", "server", "smb", "locations", "mounted", "icloud drive", "airdrop", "computer", "network", "synthesised"],
  excerpt: "A volume favorite can add a Favorites row, or show in Locations only and just icon the row Finder already lists.",
  sections: [
    { id: "two-ways", title: "Two ways to show a volume" },
    { id: "locations-rows", title: "How Locations rows are handled" },
    { id: "cannot-take-icons", title: "Rows that cannot take an icon" },
  ],
};

export function Body() {
  return (
    <>
      <H2 id="two-ways">Two ways to show a volume</H2>
      <p>A mounted disk or server can carry a custom icon too. Finder already lists every mounted volume under <strong>Locations</strong>, so a volume favorite offers a choice:</p>
      <ul>
        <li><strong>Leave it off</strong> and the app adds a row under Favorites and icons Finder&rsquo;s Locations row to match, so both agree.</li>
        <li><strong>Show in Locations only</strong> and no Favorites row is added at all. The app just icons the row Finder already shows.</li>
      </ul>
      <H2 id="locations-rows">How Locations rows are handled</H2>
      <p>Finder owns the rows in Locations, so the app only ever patches one in place. It never inserts, moves or deletes a row there, and the row is handed back untouched when the favorite is disabled or removed.</p>
      <H2 id="cannot-take-icons">Rows that cannot take an icon</H2>
      <p>Finder&rsquo;s synthesised entries (iCloud Drive, Computer, AirDrop, Network and the cloud-provider rows) cannot take a custom icon at all. macOS stores one and never draws it, so the app leaves them alone.</p>
    </>
  );
}
