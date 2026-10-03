import { asset } from "@/lib/config";
import { Reveal } from "./motion/Reveal";

const CHOICES = [
  ["Keep both icons", "Folder keeps its icon everywhere and the row keeps your glyph. Adds one small Finder Sync helper (≈ 6 MB, no window, nothing at login) for that favorite."],
  ["Remove its icon", "Back to a plain folder, which is enough to make the glyph stick. A copy is kept in IconBackups."],
  ["Leave as is", "Change nothing; the glyph disappears whenever the folder changes, until you press Refresh."],
] as const;

export default function BothIcons() {
  const n = "SBFAddFavoriteWithExistingIcon";
  return (
    <section id="both" className="sec">
      <div className="wrap bi-grid">
        <Reveal>
          <figure className="bi-fig">
            <div className="bi-shot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset(`/shots/${n}-w1008.webp`)} srcSet={`${asset(`/shots/${n}-w504.webp`)} 504w, ${asset(`/shots/${n}-w1008.webp`)} 1008w`}
                sizes="(min-width:1024px) 656px, 100vw" width={656} height={420} alt="Add Favorite sheet warning that the folder has a custom icon of its own, with the choices Keep both icons, Remove its icon and Leave as is" loading="lazy" decoding="async" />
            </div>
            <figcaption>The three ways out, offered only when a folder already carries its own icon.</figcaption>
          </figure>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="eyebrow">Keeping both icons</p>
          <h2 className="display h-sec">Folders with an icon of their own get a choice.</h2>
          <p className="lede">Pasted a custom icon into Get Info so the folder is recognisable in the Dock? On macOS 26 that icon fights the sidebar glyph. When you add such a folder the app says so and offers three ways out — none does anything until you save.</p>
          <ul className="radios">
            {CHOICES.map(([h, p], i) => (
              <li key={h} className="radio" data-on={i === 0}>
                <i aria-hidden="true" />
                <div><b>{h}</b><span>{p}</span></div>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
