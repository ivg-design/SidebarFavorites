import { asset } from "@/lib/config";
import { docShot } from "@/lib/docShots";

/**
 * A real capture in the docs: intrinsic width and height (no layout shift), 1x and 2x, a dark twin when the set
 * has one, lazy-loaded, never wider than the column, with the caption as part of the figure. Clicking the image
 * opens the 2x file in the enlarge dialog (Lightbox). Captures listed in public/shots/manifest.json arrive framed
 * on their own gradient, so the figure adds no background, border or shadow to them.
 */
export default function Figure({ shot, alt, caption }: { shot: string; alt: string; caption: React.ReactNode; max?: number }) {
  const found = docShot(shot);
  if (!found) return null;
  const { main, dark } = found;
  const set = (f: typeof main) => (f.src2x ? `${asset(f.src)} 1x, ${asset(f.src2x)} 2x` : asset(f.src));
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={asset(main.src)} srcSet={main.src2x ? set(main) : undefined} width={main.w} height={main.h} alt={alt} loading="lazy" decoding="async" />
  );
  return (
    <figure className="dx-fig" data-framed={main.framed}>
      <button
        type="button" className="dx-zoom" aria-label={`Enlarge image: ${alt}`}
        data-full={asset(main.src2x ?? main.src)} data-full-dark={dark ? asset(dark.src2x ?? dark.src) : undefined} data-w={main.w} data-h={main.h}
      >
        {dark ? <picture><source media="(prefers-color-scheme: dark)" srcSet={set(dark)} />{img}</picture> : img}
        <span className="dx-zoom-hint" aria-hidden="true">Enlarge</span>
      </button>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
