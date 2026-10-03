import { asset } from "@/lib/config";
import { SHOTS, type ShotName } from "./shots";

/** A real screenshot, shown whole at its natural aspect ratio, with a caption saying what it shows. */
export default function Figure({ shot, alt, caption, max }: { shot: ShotName; alt: string; caption: string; max?: number }) {
  const [w1, w2, h1] = SHOTS[shot];
  const src = asset(`/shots/${shot}-w${w1}.webp`);
  const src2 = asset(`/shots/${shot}-w${w2}.webp`);
  const width = max ?? w1;
  return (
    <figure className="dx-fig" style={{ maxWidth: width }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src} srcSet={`${src} ${w1}w, ${src2} ${w2}w`} sizes={`(max-width: 560px) 92vw, ${width}px`}
        width={w1} height={h1} alt={alt} loading="lazy" decoding="async"
      />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
