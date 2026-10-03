// Dev tool: headless probe. usage: node scripts/probe.mjs <url> [width] [jsExpression]
// Logs console errors/warnings, failed requests, requests matching PROBE_MATCH, and the expression's value.
import puppeteer from "puppeteer-core";
const [url, width = "1440", expr = "null"] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
const p = await b.newPage(); await p.setViewport({ width: +width, height: 900 });
p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("CONSOLE", m.type(), m.text().slice(0, 300)); });
p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 300)));
p.on("requestfailed", (r) => console.log("FAILED", r.url(), r.failure()?.errorText));
const match = process.env.PROBE_MATCH; if (match) p.on("response", (r) => { if (r.url().includes(match)) console.log("RESP", r.status(), r.headers()["content-type"], r.url()); });
await p.goto(url, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 2500));
console.log(JSON.stringify(await p.evaluate(expr), null, 1));
await b.close();
