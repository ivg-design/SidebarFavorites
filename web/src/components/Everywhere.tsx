import { Folder, Cloud, HardDrive, Server } from "lucide-react";
import { Reveal } from "./motion/Reveal";

const COLS = [
  [Folder, "Local folders", "Anything on your Mac. ~ paths welcome."],
  [Cloud, "iCloud Drive & CloudStorage", "Google Drive, Dropbox, OneDrive — the virtual FileProvider mounts older tools could never see."],
  [HardDrive, "Mounted disks", "Finder already lists them under Locations; the app icons that row, or adds a Favorites row too."],
  [Server, "Network shares", "Same as disks. Finder keeps owning the Locations row; the app only patches it in place."],
] as const;

export default function Everywhere() {
  return (
    <section id="everywhere" className="sec sec-sidebar">
      <div className="wrap">
        <Reveal>
          <p className="eyebrow">Everywhere Finder goes</p>
          <h2 className="display h-sec">Local, cloud, disks, shares.</h2>
        </Reveal>
        <div className="cols4">
          {COLS.map(([Icon, h, p], i) => (
            <Reveal key={h} delay={i * 0.06}>
              <h3><Icon size={26} strokeWidth={1.6} aria-hidden="true" />{h}</h3>
              <p>{p}</p>
            </Reveal>
          ))}
        </div>
        <Reveal><p className="fine">Finder’s own synthesised rows — iCloud Drive, Computer, AirDrop, Network, the cloud-provider rows — cannot take a custom icon at all; macOS stores one and never draws it, so the app leaves them alone.</p></Reveal>
      </div>
    </section>
  );
}
