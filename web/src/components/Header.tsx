import Image from "next/image";
import { asset, REPO_URL } from "@/lib/config";

/** Placeholder top nav until worker A lands nav.css + the real Header. */
export default function Header() {
  return (
    <header className="nav" style={{ borderBottom: "1px solid var(--line)" }}>
      <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <a href={asset("/")} style={{ display: "inline-flex", alignItems: "center", gap: 12, fontWeight: 600 }}>
          <Image src={asset("/images/icon-64.png")} alt="" width={36} height={36} priority />
          SidebarFavorites
        </a>
        <nav style={{ display: "flex", gap: 20 }}><a href={asset("/docs")}>Docs</a><a href={REPO_URL}>GitHub</a><a className="btn btn-primary btn-sm" href="#install">Install</a></nav>
      </div>
    </header>
  );
}
