import type { Metadata } from "next";
import { Fragment } from "react";
import DocsShell from "@/components/docs/DocsShell";
import { Link2 } from "lucide-react";
import DocsFooter from "@/components/docs/DocsFooter";
import { docIndex } from "@/content/docs";
import { parseChangelog } from "@/lib/changelog";
import { RELEASES_URL } from "@/lib/config";
import { CANONICAL_HOST, OG_IMAGE, toCanonicalUrl } from "@/lib/seo";
import "../docs/docs.css";

const TITLE = "Changelog | SidebarFavorites";
const DESC = "Every SidebarFavorites release, newest first: what was added, changed and fixed.";
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  metadataBase: new URL(CANONICAL_HOST),
  alternates: { canonical: toCanonicalUrl("/changelog") },
  openGraph: { title: TITLE, description: DESC, url: toCanonicalUrl("/changelog"), type: "website", siteName: "SidebarFavorites", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: [OG_IMAGE.url] },
};

/** Inline **bold**, `code` and [text](url) only. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*(?:[^*]|\*(?!\*))+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={i}><Inline text={p.slice(2, -2)} /></strong>;
        if (/^\*[^*].*\*$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
        if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return <code key={i}>{p.slice(1, -1)}</code>;
        const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (m) return <a key={i} href={m[2]} target="_blank" rel="noopener noreferrer">{m[1]}</a>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

function formatDate(d: string): string {
  if (d === "Unreleased") return d;
  const dt = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export default function Changelog() {
  const entries = parseChangelog();
  return (
    <DocsShell index={docIndex} changelog={entries.map((e) => ({ id: `v${e.version}`, title: e.version }))}>
      <main id="main" className="cl-main" tabIndex={-1}>
        <header className="page-head">
          <h1 className="dx-h1">Changelog</h1>
          <p className="dx-lede">Every release of SidebarFavorites, newest first. Release notes and downloads are also on <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">GitHub Releases</a>.</p>
        </header>
        {entries.length === 0 && <p className="cl-intro">The changelog could not be loaded. See <a href={RELEASES_URL}>GitHub Releases</a>.</p>}
        {entries.map((e) => (
          <article className="cl-entry" key={e.version} id={`v${e.version}`}>
            <div>
              <h2 className="cl-ver">{e.version}<a className="dx-anchor" href={`#v${e.version}`} aria-label={`Link to version ${e.version}`}><Link2 size={15} aria-hidden="true" /></a></h2>
              <time className="cl-date" dateTime={e.date === "Unreleased" ? undefined : e.date}>{formatDate(e.date)}</time>
            </div>
            <div>
              {e.intro && <p className="cl-intro"><Inline text={e.intro} /></p>}
              {e.sections.map((s) => (
                <Fragment key={s.title}>
                  <h3>{s.title}</h3>
                  <ul>
                    {s.items.map((it, i) => {
                      const [head, ...subs] = it.split(" • ");
                      return (
                        <li key={i}>
                          <Inline text={head} />
                          {subs.length > 0 && <ul>{subs.map((x, j) => <li key={j}><Inline text={x} /></li>)}</ul>}
                        </li>
                      );
                    })}
                  </ul>
                </Fragment>
              ))}
            </div>
          </article>
        ))}
      </main>
      <DocsFooter />
    </DocsShell>
  );
}
