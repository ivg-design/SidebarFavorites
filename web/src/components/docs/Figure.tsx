import { asset } from "@/lib/config";
import { SHOTS, type ShotName } from "./shots";

/**
 * A real screenshot with caption. `max` caps the displayed width in px (tall windows stay readable);
 * `crop` shows a wide strip of the image (aspect ratio w/h) positioned at `focus` percent from the top.
 */
export default function Figure({ shot, alt, caption, max, crop, focus = 0 }: {
  shot: ShotName; alt: string; caption: string; max?: number; crop?: number; focus?: number;
}) {
  const [w1, w2, h1] = SHOTS[shot];
  const src = asset(`/shots/${shot}-w${w1}.webp`);
  const src2 = asset(`/shots/${shot}-w${w2}.webp`);
  const width = max ?? w1;
  return (
    <figure className="dx-fig" style={{ maxWidth: width }}>
      <div className="dx-fig-box" style={crop ? { aspectRatio: String(crop) } : { aspectRatio: `${w1} / ${h1}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src} srcSet={`${src} ${w1}w, ${src2} ${w2}w`} sizes={`(max-width: 560px) 92vw, ${width}px`}
          width={w1} height={h1} alt={alt} loading="lazy" decoding="async"
          style={crop ? { objectFit: "cover", objectPosition: `50% ${focus}%`, width: "100%", height: "100%" } : undefined}
        />
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
