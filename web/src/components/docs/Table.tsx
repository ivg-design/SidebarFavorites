import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

type El = ReactElement<{ children?: ReactNode; "data-label"?: string }>;

/** Plain text of a node (for header labels and cell length). */
function textOf(n: ReactNode): string {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  if (isValidElement(n)) return textOf((n as El).props.children);
  return "";
}

/** Break points inside inline code: after / . _ - : = ? & , so long tokens wrap at separators. */
const BREAK = /(?<=[/._\-:=?&,])/;
function soften(n: ReactNode): ReactNode {
  if (typeof n === "string") {
    const parts = n.split(BREAK);
    return parts.length < 2 ? n : parts.flatMap((p, i) => (i ? [<wbr key={i} />, p] : [p]));
  }
  if (Array.isArray(n)) return Children.map(n, soften);
  if (isValidElement(n)) {
    const e = n as El;
    return cloneElement(e, undefined, soften(e.props.children));
  }
  return n;
}

function walk(n: ReactNode, labels: string[], inCell: boolean): ReactNode {
  return Children.map(n, (c) => {
    if (!isValidElement(c)) return c;
    const e = c as El;
    const t = e.type;
    if (t === "code") {
      // Short tokens stay whole; long ones may break, but only after a separator.
      if (textOf(e.props.children).length <= 14) return cloneElement(e as ReactElement<{ className?: string }>, { className: "dx-tk" });
      return cloneElement(e, undefined, soften(e.props.children));
    }
    if (t === "tr") {
      let i = 0;
      return cloneElement(e, undefined, Children.map(e.props.children, (cell) => {
        if (!isValidElement(cell)) return cell;
        const ce = cell as El;
        const label = ce.type === "td" ? labels[i] : undefined;
        i += 1;
        return cloneElement(ce, label ? { "data-label": label } : undefined, walk(ce.props.children, labels, true));
      }));
    }
    return cloneElement(e, undefined, walk(e.props.children, labels, inCell));
  });
}

function headLabels(n: ReactNode): string[] {
  let out: string[] = [];
  Children.forEach(n, (c) => {
    if (!isValidElement(c)) return;
    const e = c as El;
    if (e.type === "th") out.push(textOf(e.props.children));
    else out = out.concat(headLabels(e.props.children));
  });
  return out;
}

function cellLengths(n: ReactNode): number[] {
  let out: number[] = [];
  Children.forEach(n, (c) => {
    if (!isValidElement(c)) return;
    const e = c as El;
    if (e.type === "td") out.push(textOf(e.props.children).length);
    else out = out.concat(cellLengths(e.props.children));
  });
  return out;
}

/** Fits its container: no scrolling. Code tokens get break points; on phones wide tables restack into labelled rows. */
export default function Table({ children, label }: { children: ReactNode; label: string }) {
  const labels = headLabels(children);
  const long = Math.max(0, ...cellLengths(children)) > 40;
  const stack = labels.length >= 3 || (labels.length === 2 && long);
  return (
    <div className="dx-table" role="group" aria-label={label} data-stack={stack}>
      <table>{walk(children, labels, false)}</table>
    </div>
  );
}
