import { Reveal } from "./motion/Reveal";
import Shot from "./Shot";
import HoodTree from "./hood/HoodTree";
import { HOOD_CHAIN } from "./hood/nodes";
import { nb } from "@/lib/nowrap";
import "@/app/hood.css";

export default function UnderTheHood() {
  return (
    <section id="hood" className="sec sec-dark uh" aria-labelledby="hood-h">
      <div className="wrap">
        <Reveal className="sec-head">
          <p className="eyebrow">Under the hood</p>
          <h2 className="h2" id="hood-h">No extension. No daemon. No login item.</h2>
          <p className="lede">{nb("Every row in Finder’s Favorites can carry a private per-item property holding a four-character code that Launch Services resolves to an icon. SidebarFavorites allocates one code per favorite and installs a single tiny helper bundle that declares them.")}</p>
        </Reveal>

        <Reveal className="uh-block">
          <HoodTree />
        </Reveal>

        <Reveal className="uh-block">
          <p className="uh-chain mono" data-testid="uh-chain">
            {HOOD_CHAIN.map((s, i) => (
              <span key={s}>{i > 0 && <span className="uh-arrow" aria-hidden="true"> → </span>}<span className="uh-step">{nb(s)}</span></span>
            ))}
          </p>
        </Reveal>

        <div className="cols uh-block uh-updates">
          <Reveal>
            <Shot name="SBFTaskbarPopOver" alt="The SidebarFavorites menu bar popover listing five favorites, each with its icon, above Open, Refresh All, Preferences and Quit."
              caption={nb("Every favorite one click away in the menu bar, with its icon. The app is only needed to add, edit or remove a favorite: quit it and the icons stay.")} />
          </Reveal>
          <Reveal delay={0.08} className="uh-upd">
            <h3 className="h3">{nb("Updates: one check per launch")}</h3>
            <div className="prose">
              <p>{nb("The app asks GitHub once per launch whether a newer release exists. Download opens the release page; Later dismisses the notice until the next launch.")}</p>
              <p>{nb("Nothing is automatic: no background checking, no download, nothing installed behind your back. Offline, it says nothing at all.")}</p>
            </div>
            <Shot name="SBFUpdateNotification" alt="The update notice over the manager window: a new version is available, with Later and Download buttons."
              caption={nb("The whole update mechanism: a notice with two buttons.")} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
