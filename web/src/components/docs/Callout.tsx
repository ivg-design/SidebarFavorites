import { Info, Lightbulb, TriangleAlert } from "lucide-react";

const KINDS = {
  note: { Icon: Info, label: "Note" },
  tip: { Icon: Lightbulb, label: "Tip" },
  warn: { Icon: TriangleAlert, label: "Warning" },
} as const;

/** A note, tip or warning. The kind is always named in words, never by colour or icon alone. */
export default function Callout({ kind = "note", title, id, children }: { kind?: "note" | "tip" | "warn" | "info"; title?: string; id?: string; children: React.ReactNode }) {
  const k = kind === "info" ? "note" : kind;
  const { Icon, label } = KINDS[k];
  return (
    <aside id={id} className="dx-callout" data-kind={k} role="note">
      <p className="dx-callout-k"><Icon size={16} aria-hidden="true" />{label}</p>
      <div className="dx-callout-b">{title && <strong>{title} </strong>}{children}</div>
    </aside>
  );
}
