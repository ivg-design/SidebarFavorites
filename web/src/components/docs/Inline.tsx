import { Fragment } from "react";

/** A menu or settings path: <MenuPath items={["System Settings", "General", "Login Items & Extensions"]} />. */
export function MenuPath({ items }: { items: string[] }) {
  return (
    <strong className="dx-path">
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 && <><span className="dx-path-c" aria-hidden="true">›</span><span className="sr-only"> then </span></>}
          <span className="dx-path-s">{it}</span>
        </Fragment>
      ))}
    </strong>
  );
}

/** A key or a key combination: <Kbd>⌘N</Kbd>. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="dx-kbd">{children}</kbd>;
}
