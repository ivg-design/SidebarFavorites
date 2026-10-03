"use client";
import { useRef } from "react";
import { useInView } from "framer-motion";
import { asset } from "@/lib/config";
import { Reveal } from "./motion/Reveal";
import { FlipIn } from "./flip/Flip";
import "@/app/flow.css";

const TRACE = [
  "Favorites row",
  "com.apple.LSSharedFileList.OverrideIcon.OSType",
  "Launch Services",
  "SidebarFavoritesIcons.app (UTI per favorite)",
  "SF Symbol",
];

const LEDGER = [
  { num: "17 bytes", body: <>The helper bundle’s “executable” is a <code>#!/bin/sh</code> no-op. It exists so macOS registers the bundle. It is never launched.</> },
  { num: "0 processes", body: <>Nothing runs after you quit. Icons survive reboots and Finder restarts on their own. (Both icons mode adds one small opt-in helper per favorite.)</> },
  { num: "1 file", body: <>Configuration is <code>~/Library/Application Support/SidebarFavorites/config.json</code>; imported artwork sits in <code>Icons/</code> beside it.</> },
  { num: "1 request", body: <>Updates: one GitHub check per launch, no background checking, no automatic download. Offline, it says nothing.</> },
];

function Trace() {
  const ref = useRef<HTMLOListElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.5 });
  return (
    <ol className="uh-trace" ref={ref} data-in={seen} aria-label="How a favorite gets its icon" data-testid="hood-trace">
      {TRACE.map((t, i) => (
        <li key={t} style={{ ["--i" as string]: i }}>
          <span className="uh-node" aria-hidden="true" />
          <code>{t}</code>
        </li>
      ))}
    </ol>
  );
}

export default function UnderTheHood() {
  return (
    <section id="hood" className="sec-graphite uth uh">
      <div className="wrap">
        <Reveal>
          <p className="eyebrow">Under the hood</p>
          <h2 className="display h-sec">No extension. No daemon. No login item.</h2>
          <p className="lede">Every row in Finder’s Favorites can carry a private per-item property holding a four-character code that Launch Services resolves to an icon. SidebarFavorites allocates one code per favorite and installs a single tiny helper bundle that declares them. That is the whole mechanism for a normal favorite.</p>
        </Reveal>
        <Trace />
        <ol className="uh-ledger">
          {LEDGER.map((l, i) => (
            <li className="uh-row" key={l.num}>
              <FlipIn as="div" className="uh-num" text={l.num} perChar={40} delayStart={i * 120} data-testid={`hood-num-${i}`} />
              <p>{l.body}</p>
            </li>
          ))}
        </ol>
        <Reveal className="uh-pop">
          <div className="uh-shot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset("/shots/SBFTaskbarPopOver-w292.webp")} srcSet={`${asset("/shots/SBFTaskbarPopOver-w292.webp")} 292w, ${asset("/shots/SBFTaskbarPopOver-w584.webp")} 584w`}
              sizes="300px" width={292} height={Math.round(292 * 1.15)} alt="The SidebarFavorites menu bar popover listing every favorite with its icon" loading="lazy" decoding="async" />
          </div>
          <div>
            <h3>Every favorite one click away in the menu bar, with its icon.</h3>
            <p>The app is only needed to add, edit or remove a favorite. Keep it in the menu bar for quick access, or quit it — the icons stay.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
