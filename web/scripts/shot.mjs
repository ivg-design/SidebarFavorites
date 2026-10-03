// Dev tool: headless full-page screenshot via CDP, with true viewport widths,
// optional reduced-motion emulation, and a scroll pass so in-view animations fire.
// usage: node scripts/shot.mjs <url> <out.png> [width=1440] [reduced=0|1] [clickSelector]
import { spawn } from "node:child_process";
import fs from "node:fs";

const [url, out, width = "1440", reduced = "0", click] = process.argv.slice(2);
const CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9400 + Math.floor(Math.random() * 400);
const proc = spawn(CH, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=/private/tmp/claude-501/sbf/prof-${port}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d.error); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value;

const w = +width;
await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 600 });
if (reduced === "1") await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await send("Page.enable");
await send("Page.navigate", { url });
await sleep(2500);
if (click) { await ev(`document.querySelector(${JSON.stringify(click)})?.click()`); await sleep(1200); }
const H = await ev("document.documentElement.scrollHeight");
for (let y = 0; y < H; y += 450) { await ev(`window.scrollTo(0, ${y})`); await sleep(160); }
await sleep(1200);
await ev("window.scrollTo(0, 0)"); await sleep(500);
const total = await ev("document.documentElement.scrollHeight");
const overflow = await ev("document.documentElement.scrollWidth - window.innerWidth");
await send("Emulation.setDeviceMetricsOverride", { width: w, height: total, deviceScaleFactor: 1, mobile: w < 600 });
await sleep(600);
const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log(`${out} ${w}x${total} horizontal-overflow=${overflow}`);
ws.close(); proc.kill();
