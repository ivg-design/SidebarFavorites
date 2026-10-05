/** A procedure. One action per step. */
export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="dx-steps">{children}</ol>;
}

/**
 * One numbered step. `title` is the action, in the imperative, naming the exact control.
 * The children explain it (text, a figure, a code block). `see` is what the reader sees afterwards.
 */
export function Step({ id, title, see, children }: { id?: string; title: React.ReactNode; see?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="dx-step" id={id}>
      <p className="dx-step-title">{title}</p>
      {children && <div className="dx-step-body">{children}</div>}
      {see && <See>{see}</See>}
    </li>
  );
}

/** The visible outcome of a step or a procedure. */
export function See({ children }: { children: React.ReactNode }) {
  return <p className="dx-see"><span className="dx-see-k">You see</span><span>{children}</span></p>;
}
