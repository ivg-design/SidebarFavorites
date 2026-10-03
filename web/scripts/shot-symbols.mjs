// Dev tool: screenshot of #symbols (viewport-sized crop of the band), optionally after typing.
// usage: node scripts/shot-symbols.mjs <base> <out.png> [width=1440] [typeText]
import puppeteer from "puppeteer-core";
const [base, out, width = "1440", text] = process.argv.slice(2);
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const w = +width;
const b = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox", "--hide-scrollbars"] });
try {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: 900, deviceScaleFactor: 1, isMobile: w < 600 });
  await p.goto(base + "/#symbols", { waitUntil: "networkidle0", timeout: 60000 });
  await sleep(1200);
  if (text) {
    await p.focus('[data-testid="symbols-input"]');
    await p.type('[data-testid="symbols-input"]', text);
    await sleep(500);
    await p.keyboard.press("Enter");
    await sleep(900);
  }
  const el = await p.$("#symbols");
  await el.scrollIntoView(); await sleep(900);
  await el.screenshot({ path: out });
  console.log(out);
} finally { await b.close(); }
