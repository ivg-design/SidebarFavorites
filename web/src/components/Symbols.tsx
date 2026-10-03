import { nb } from "@/lib/nowrap";
import { Reveal } from "@/components/motion/Reveal";
import SymbolWall from "@/components/symbols/SymbolWall";
import SymbolStage from "@/components/symbols/SymbolStage";
import "@/app/symbols.css";

/** 8,300 symbols, by name. A wall of real SF Symbol names is the band's texture; the search field is the app's Browse All…. */
export default function Symbols() {
  return (
    <section id="symbols" className="sec-band sec-dark sy-sec" aria-labelledby="symbols-h">
      <div className="wrap">
        <Reveal className="sec-head">
          <h2 className="h2" id="symbols-h">{nb("Every symbol your Mac can draw, by name.")}</h2>
          <p className="lede">
            {nb("Browse All… in the app searches the whole SF Symbols catalogue on your Mac — about 8,300 symbols on a current macOS — by name or by keyword, so “bin” finds trash. Type a name here to search the catalogue this page was built from.")}
          </p>
        </Reveal>
      </div>
      <SymbolStage wall={<SymbolWall />} />
    </section>
  );
}
