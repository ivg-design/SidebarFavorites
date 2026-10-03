import { Link2 } from "lucide-react";

function Anchor({ id, label }: { id: string; label: string }) {
  return <a className="dx-anchor" href={`#${id}`} aria-label={`Link to ${label}`}><Link2 size={15} aria-hidden="true" /></a>;
}
const text = (c: React.ReactNode) => (typeof c === "string" ? c : "this section");

export function H2({ id, children, hidden }: { id: string; children: React.ReactNode; hidden?: boolean }) {
  if (hidden) return <h2 id={id} className="sr-only">{children}</h2>;
  return <h2 id={id} className="dx-h2">{children}<Anchor id={id} label={text(children)} /></h2>;
}
export function H3({ id, children }: { id: string; children: React.ReactNode }) {
  return <h3 id={id} className="dx-h3">{children}<Anchor id={id} label={text(children)} /></h3>;
}
