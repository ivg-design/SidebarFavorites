import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { nb } from "@/lib/nowrap";

type AnyProps = Record<string, unknown> & { children?: ReactNode };
/** Props whose text is shown to the reader. Code, alt text, ids and labels are left as written. */
const TEXT_PROPS = ["children", "title", "see", "caption"];

/**
 * Owner rule: proper nouns and control names never break across lines. Walks a docs page's element tree and
 * joins every protected phrase (src/lib/nowrap.ts) with no-break spaces, in children and in the text props of
 * the docs components. Inline code and code blocks are skipped.
 */
export function nbTree(node: ReactNode): ReactNode {
  if (typeof node === "string") return nb(node);
  if (Array.isArray(node)) return Children.map(node, nbTree);
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<AnyProps>;
  if (el.type === "code" || el.type === "pre") return el;
  const next: AnyProps = {};
  for (const key of TEXT_PROPS) {
    const v = el.props[key];
    if (v == null) continue;
    next[key] = key === "children" ? nbTree(v as ReactNode) : typeof v === "string" ? nb(v) : nbTree(v as ReactNode);
  }
  if (Array.isArray(el.props.items)) next.items = (el.props.items as unknown[]).map((i) => (typeof i === "string" ? nb(i) : i));
  return cloneElement(el, next);
}
