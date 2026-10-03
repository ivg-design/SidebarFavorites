import names from "@/data/sf-names.json";

/** Server component: the wall's rows are chosen with a fixed seed so every render is identical.
 *  The catalogue is imported here only, so it never enters the client bundle through this file. */
const ROWS = 20; // phones hide the last 9 in CSS
const PER_ROW = 70;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sample(): string[][] {
  const all = names as string[];
  const rnd = mulberry32(8300);
  const pool = all.slice();
  const out: string[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: string[] = [];
    for (let i = 0; i < PER_ROW; i++) {
      const k = Math.floor(rnd() * pool.length);
      row.push(pool[k]);
      pool.splice(k, 1);
    }
    out.push(row);
  }
  return out;
}

/** Drift is a constant speed in px/s (10-16, per row); duration = one half's width / speed, so more names never drift faster.
 *  Width is estimated from JetBrains Mono's 0.6em advance at 13px plus the flex gap and the left padding. */
const SPEEDS = [10, 13, 16, 11, 14, 12, 15, 10, 16, 13];
const ADV = 7.2, GAP = 24, PAD = 80;
const dur = (row: string[], r: number) => Math.round((row.reduce((w, n) => w + n.length * ADV + GAP, PAD)) / SPEEDS[r % SPEEDS.length]);

export default function SymbolWall() {
  const rows = sample();
  return (
    <div className="sy-wall" aria-hidden="true" data-testid="symbols-wall">
      {rows.map((row, r) => (
        <div key={r} className="sy-row" data-r={r} data-dir={r % 2 ? "rev" : "fwd"} style={{ ["--sy-dur" as string]: `${dur(row, r)}s` }}>
          {[0, 1].map((copy) => (
            <span key={copy} className="sy-half">
              {row.map((n, i) => (
                <span key={i} className="sy-n mono" data-n={n} data-i={i}>{n}</span>
              ))}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
