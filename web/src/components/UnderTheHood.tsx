import { Reveal } from "./motion/Reveal";
import Shot from "./Shot";
import HoodTree from "./hood/HoodTree";
import { HOOD_FACTS } from "./hood/nodes";
import { nb } from "@/lib/nowrap";
import "@/app/hood.css";

export default function UnderTheHood() {
  return (
    <section id="hood" className="sec-band sec-dark uh" aria-labelledby="hood-h">
      <div className="wrap">
        <Reveal className="uh-head">
          <h2 className="h2" id="hood-h">No extension. No daemon. No login item.</h2>
          <p className="lede">{nb("A normal favorite needs one private property on its Finder row and one small helper bundle that is never launched. This is everything the app writes. Choose a file.")}</p>
        </Reveal>

        <div className="uh-block"><HoodTree /></div>

        <div className="uh-block uh-lower">
          <Reveal className="uh-facts">
            {HOOD_FACTS.map(([lead, rest]) => (
              <p key={lead}><b>{nb(lead)}</b> {nb(rest)}</p>
            ))}
          </Reveal>
          <Reveal className="uh-upd">
            <h3 className="h3">{nb("Updates: one request per launch")}</h3>
            <p className="prose">{nb("The app asks GitHub once per launch whether a newer release exists. No background checking, no download, nothing installed behind your back. Offline, it says nothing.")}</p>
            <Shot name="SBFUpdateNotification" alt="The update notice over the manager window: a new version is available, with Later and Download buttons."
              caption={nb("The whole update mechanism: a notice with two buttons.")} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
