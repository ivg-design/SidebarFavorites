import type { CSSProperties } from "react";
import { asset } from "@/lib/config";
import { SHOTS, SHOT_SCALE, type ShotName } from "@/lib/shots";

export type { ShotName };

/**
 * A real screenshot at the site's one scale (0.65x of its retina pixels, 1.3x true size).
 * Whole window by default. A `crop` is a deliberate, labelled detail crop: source-px `y` and `h`
 * (and optional `x`/`w`), rendered at the same scale, with `cropLabel` shown in the caption.
 */
export default function Shot({ name, alt, caption, crop, cropLabel, priority, className, testId }: {
  name: ShotName; alt: string; caption?: string; priority?: boolean; className?: string; testId?: string;
  crop?: { y: number; h: number; x?: number; w?: number }; cropLabel?: string;
}) {
  const { w, h, display } = SHOTS[name];
  const s1 = asset(`/shots/${name}-w${display}.webp`);
  const s2 = asset(`/shots/${name}-w${w}.webp`);
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={s1} srcSet={`${s1} ${display}w, ${s2} ${w}w`} sizes={`(max-width: 600px) calc(100vw - 32px), ${display}px`}
      width={display} height={Math.round(h * SHOT_SCALE)} alt={alt}
      loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async"
      className={crop ? undefined : "shot"} style={{ ["--shot-w" as string]: w } as CSSProperties}
      data-testid={testId}
    />
  );
  if (!crop) {
    if (!caption) return img;
    return <figure className={`shot-fig ${className ?? ""}`}>{img}<figcaption>{caption}</figcaption></figure>;
  }
  const cw = crop.w ?? w, cx = crop.x ?? 0;
  const style = {
    ["--shot-w" as string]: cw, aspectRatio: `${cw} / ${crop.h}`, width: `min(100%, ${Math.round(cw * SHOT_SCALE)}px)`,
    overflow: "hidden", position: "relative", borderRadius: "var(--r-3)", boxShadow: "0 1px 0 rgba(20,19,17,.06), 0 24px 48px -24px rgba(20,19,17,.35)",
  } as CSSProperties;
  const inner = { position: "absolute", width: `${(w / cw) * 100}%`, left: `${(-cx / cw) * 100}%`, top: `${(-crop.y / crop.h) * 100}%` } as CSSProperties;
  return (
    <figure className={`shot-fig ${className ?? ""}`}>
      <div className="shot-crop" style={style} data-testid={testId ? `${testId}-crop` : undefined}><div style={inner}>{img}</div></div>
      <figcaption><b>Detail: {cropLabel ?? "crop"}.</b> {caption}</figcaption>
    </figure>
  );
}
