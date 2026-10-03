import { ArrowLeft, ArrowRight } from "lucide-react";
import { asset } from "@/lib/config";
import { getDoc, neighbours, docUrl } from "@/content/docs";
import DocsFooter from "./DocsFooter";

/** One docs page: breadcrumb, h1, lede, body, prev/next. */
export default function DocArticle({ slug }: { slug: string }) {
  const doc = getDoc(slug);
  if (!doc) return null;
  const { prev, next } = neighbours(slug);
  const { Body } = doc;
  return (
    <>
      <main id="main" className="dx-main" tabIndex={-1}>
        <nav className="dx-crumbs" aria-label="Breadcrumb">
          <ol>
            <li>{doc.group}</li>
            <li aria-current="page">{doc.title}</li>
          </ol>
        </nav>
        <h1 className="dx-h1">{doc.title}</h1>
        <p className="dx-lede">{doc.description}</p>
        <div className="dx-prose"><Body /></div>
        <nav className="dx-pn" aria-label="Previous and next page">
          {prev ? <a className="dx-prev" data-testid="docs-prev" href={asset(docUrl(prev.slug))} rel="prev"><ArrowLeft size={16} aria-hidden="true" />{prev.title}</a> : <span />}
          {next ? <a className="dx-next" data-testid="docs-next" href={asset(docUrl(next.slug))} rel="next">{next.title}<ArrowRight size={16} aria-hidden="true" /></a> : <span />}
        </nav>
      </main>
      <DocsFooter />
    </>
  );
}
