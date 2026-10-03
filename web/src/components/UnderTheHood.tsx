import { asset } from "@/lib/config";
import { Reveal } from "./motion/Reveal";
import CountUp from "./CountUp";

export default function UnderTheHood() {
  return (
    <section id="hood" className="sec-graphite uth">
      <div className="wrap">
        <Reveal>
          <p className="eyebrow">Under the hood</p>
          <h2 className="display h-sec">No extension. No daemon. No login item.</h2>
          <p className="lede">Every row in Finder’s Favorites can carry a private per-item property holding a four-character code that Launch Services resolves to an icon. SidebarFavorites allocates one code per favorite and installs a single tiny helper bundle that declares them. That is the whole mechanism for a normal favorite.</p>
        </Reveal>
        <ol className="ledger">
          <li className="led">
            <div className="num" aria-label="17 bytes"><span aria-hidden="true"><CountUp to={17} /> bytes</span></div>
            <p>The helper bundle’s “executable” is a <code>#!/bin/sh</code> no-op. It exists so macOS registers the bundle. It is never launched.</p>
          </li>
          <li className="led">
            <div className="num" aria-label="0 processes"><span aria-hidden="true"><CountUp from={9} to={0} /> processes</span></div>
            <p>Nothing runs after you quit. Icons survive reboots and Finder restarts on their own. (Both icons mode adds one small opt-in helper per favorite.)</p>
          </li>
          <li className="led">
            <div className="num" aria-label="1 file"><span aria-hidden="true"><CountUp from={0} to={1} /> file</span></div>
            <p>Configuration is <code>~/Library/Application Support/SidebarFavorites/config.json</code>; imported artwork sits in <code>Icons/</code> beside it.</p>
          </li>
          <li className="led">
            <div className="num" aria-label="1 request"><span aria-hidden="true"><CountUp from={0} to={1} /> request</span></div>
            <p>Updates: one GitHub check per launch, no background checking, no automatic download. Offline, it says nothing.</p>
          </li>
        </ol>
        <Reveal className="pop">
          <div className="pop-shot">
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
