"use client";
import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { DEMO_VIDEO_SRC, asset } from "@/lib/config";
import "@/app/flow.css";

const PENDING = "The recording is being made. Check back soon.";
const SUB = "Add a folder → pick a symbol → done. Then an SVG import with the size slider.";

export default function DemoVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pending, setPending] = useState(false);
  const src = DEMO_VIDEO_SRC ? (/^https?:/.test(DEMO_VIDEO_SRC) ? DEMO_VIDEO_SRC : asset(DEMO_VIDEO_SRC)) : null;

  const start = () => {
    if (!src) { setPending(true); return; }
    setPlaying(true);
    const v = ref.current;
    if (v) { v.muted = false; void v.play().catch(() => { v.muted = true; void v.play(); }); }
  };

  return (
    <section className="dv" aria-label="Demo video">
      <div className="wrap">
        <div className="dv-shell" data-testid="demo-video">
          <video
            ref={ref} poster={asset("/shots/demo-poster.webp")} preload="none" playsInline muted loop
            controls={playing} aria-label="SidebarFavorites demo: a grey sidebar becomes legible in 30 seconds"
          >
            {src && <source src={src} type="video/mp4" />}
          </video>
          {!playing && (
            <button type="button" className="dv-over" onClick={start} aria-label="Play demo video" data-testid="demo-play">
              <span className="dv-play"><Play size={34} strokeWidth={2} fill="currentColor" aria-hidden="true" /></span>
              <h3>{src ? "Watch: a grey sidebar becomes legible in 30 seconds" : "Demo recording coming soon"}</h3>
              <p aria-live="polite">{pending ? PENDING : SUB}</p>
            </button>
          )}
        </div>
        <p className="dv-cap">{src ? "Short demo, muted autoplay loop with captions; click for sound." : "The 30-second demo (a grey sidebar becomes legible) is still to be recorded."}</p>
      </div>
    </section>
  );
}
