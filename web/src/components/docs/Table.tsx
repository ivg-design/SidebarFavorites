/** Scrolls inside its own box, never the page. */
export default function Table({ children, label }: { children: React.ReactNode; label: string }) {
  return <div className="dx-table" role="region" aria-label={label} tabIndex={0}><table>{children}</table></div>;
}
