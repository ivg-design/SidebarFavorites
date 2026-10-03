import { Info, TriangleAlert } from "lucide-react";

export default function Callout({ kind = "info", title, id, children }: { kind?: "info" | "warn"; title?: string; id?: string; children: React.ReactNode }) {
  const Icon = kind === "warn" ? TriangleAlert : Info;
  return (
    <aside id={id} className="dx-callout" data-kind={kind} role="note">
      <Icon size={18} aria-hidden="true" />
      <div>{title && <strong>{title} </strong>}{children}</div>
    </aside>
  );
}
