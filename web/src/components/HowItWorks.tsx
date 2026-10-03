"use client";
import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { asset } from "@/lib/config";
import { EASE_QUART } from "./motion/Reveal";

interface Step { n: number; title: string; text: string; img: string; widths: [number, number]; w: number; h: number; pos: string; alt: string }

const STEPS: Step[] = [
  { n: 1, title: "Click + and pick the folder", img: "SBFMainWindow", widths: [430, 860], w: 860, h: 1124, pos: "50% 28%",
    alt: "The SidebarFavorites window listing folders, each with its icon and an In Sidebar toggle",
    text: "Browse, or type a path — ~ works. Local folders, iCloud Drive, Google Drive, Dropbox, OneDrive, mounted disks and network shares all count." },
  { n: 2, title: "Choose the icon", img: "SFSymbolBrowser", widths: [560, 1119], w: 1119, h: 1197, pos: "50% 22%",
    alt: "The SF Symbols browser showing a grid of symbols with a search field",
    text: "Type an SF Symbol name, click a quick pick, or Browse All… to search every one of the roughly 8,300 symbols this Mac can draw — by name or keyword, so “bin” finds trash. Or import any SVG." },
  { n: 3, title: "Add", img: "SBFAddFavoriteWindow", widths: [480, 960], w: 960, h: 1930, pos: "50% 57%",
    alt: "The Add Favorite window's Icon section with the SF Symbol type, symbol name and quick picks",
    text: "The folder appears in Finder's sidebar with your icon. If Finder is still showing an old one, a banner offers Restart Finder — the app never restarts it on its own." },
];

function StepCard({ s, i, reduce }: { s: Step; i: number; reduce: boolean }) {
  const ref = useRef<HTMLLIElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.3 });
  const in_ = seen || reduce;
  const srcSet = s.widths.map((w) => `${asset(`/shots/${s.img}-w${w}.webp`)} ${w}w`).join(", ");
  return (
    <li className="step" ref={ref} data-in={in_}>
      <motion.div
        className="shot"
        initial={false}
        animate={{ opacity: in_ ? 1 : 0, y: in_ ? 0 : 12 }}
        transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : i * 0.1, ease: EASE_QUART }}
      >
        <img
          src={asset(`/shots/${s.img}-w${s.widths[1]}.webp`)} srcSet={srcSet}
          sizes="(min-width: 834px) 33vw, 100vw" width={s.w} height={s.h} alt={s.alt}
          loading="lazy" decoding="async" style={{ objectPosition: s.pos }}
        />
      </motion.div>
      <h3 className="step-h"><span className="step-n" aria-hidden="true"><span>{s.n}</span></span>{s.title}</h3>
      <p>{s.text}</p>
    </li>
  );
}

export default function HowItWorks() {
  const reduce = !!useReducedMotion();
  return (
    <section id="how" className="sec sec-surface" aria-labelledby="how-title">
      <div className="wrap">
        <p className="eyebrow">How it works</p>
        <h2 id="how-title" className="display">Pick a folder. Pick an icon. Add.</h2>
        <p className="lede">Three fields and a button. The name follows the folder because Finder always labels a favorite with its real name — so you only ever choose the glyph.</p>
        <ol className="steps">
          {STEPS.map((s, i) => <StepCard key={s.n} s={s} i={i} reduce={reduce} />)}
        </ol>
      </div>
    </section>
  );
}
