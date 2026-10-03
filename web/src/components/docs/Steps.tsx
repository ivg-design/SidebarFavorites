export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="dx-steps">{children}</ol>;
}
/** One numbered coral step. `id` makes the title a table-of-contents target. */
export function Step({ id, title, children }: { id: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="dx-step">
      <h2 id={id} className="dx-step-title">{title}</h2>
      <p>{children}</p>
    </li>
  );
}
