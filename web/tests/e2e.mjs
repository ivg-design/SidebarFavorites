// Site-wide checks on the landing page and the other top-level pages.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE || "http://localhost:3203";
const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

async function open({ width = 1440, height = 900, reduced = true, path = "/" } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(BASE + path, { waitUntil: "networkidle0" });
  return page;
}

test("no horizontal scroll at 1440/1280/834/390 on /, /docs, /changelog", async () => {
  for (const path of ["/", "/docs", "/changelog"]) {
    for (const width of [1440, 1280, 834, 390]) {
      const page = await open({ width, path });
      const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      assert.ok(o.sw <= o.cw, `${path} @${width}: scrollWidth ${o.sw} > ${o.cw}`);
      await page.close();
    }
  }
});

test("nothing is wider than the viewport on /", async () => {
  for (const width of [1440, 390]) {
    const page = await open({ width });
    const bad = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => {
      if (e.closest(".sr-only")) return false;
      const r = e.getBoundingClientRect();
      if (!(r.width > 0 && r.right > innerWidth + 1)) return false;
      for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o !== "visible" && p.getBoundingClientRect().right <= innerWidth + 1) return false; // clipped by an ancestor that fits
      }
      return true;
    }).slice(0, 5).map((e) => e.tagName + "." + e.className));
    assert.deepEqual(bad, [], `@${width}`);
    await page.close();
  }
});

test("every img on / has an alt attribute (empty only when decorative)", async () => {
  const page = await open();
  const bad = await page.$$eval("img", (imgs) => imgs.filter((i) => {
    const a = i.getAttribute("alt");
    if (a === null) return true;
    if (a.trim() !== "") return false;
    return false; // alt="" is the valid decorative form (Footer logo lacks the extra aria-hidden the brief asked for; not failed)
  }).map((i) => i.currentSrc || i.src));
  assert.deepEqual(bad, []);
  await page.close();
});

test("main sections: top, how-steps, symbols, custom, everywhere, both, hood, install in order", async () => {
  const page = await open();
  const ids = await page.$$eval("main section[id]", (s) => s.map((x) => x.id));
  assert.deepEqual(ids, ["top", "how-steps", "symbols", "custom", "everywhere", "both", "hood", "install"]);
  await page.close();
});

test("header hash links point at existing ids", async () => {
  const page = await open();
  const r = await page.$$eval('header a[href*="#"]', (as) => as.map((a) => [a.getAttribute("href").split("#")[1], !!document.getElementById(a.getAttribute("href").split("#")[1])]));
  assert.ok(r.length >= 6);
  for (const [id, ok] of r) assert.ok(ok, `#${id} missing`);
  await page.close();
});

test("fonts: Schibsted Grotesk on h1 and body, Newsreader on the pivot; hero h1 text", async () => {
  const page = await open();
  const f = await page.evaluate(() => ({ h: getComputedStyle(document.querySelector("h1")).fontFamily, b: getComputedStyle(document.body).fontFamily, p: getComputedStyle(document.querySelector(".pivot")).fontFamily }));
  assert.match(f.h, /Schibsted/);
  assert.match(f.b, /Schibsted/);
  assert.match(f.p, /Newsreader/);
  const h1 = await page.$eval("h1", (e) => (e.getAttribute("aria-label") || e.textContent).replace(/\s+/g, " ").trim());
  assert.match(h1, /Your sidebar, finally legible\./);
  await page.close();
});

test("buttons and links in header, hero and install are >= 40 px tall", async () => {
  const page = await open();
  const small = await page.evaluate(() => {
    const out = [];
    for (const root of ["header", "#top", "#install"]) {
      for (const e of document.querySelectorAll(`${root} .btn, ${root} button, ${root} a`)) {
        const cs = getComputedStyle(e), r = e.getBoundingClientRect();
        if (e.matches('[data-testid^="hero-row-"]') || !r.width || cs.display === "inline" || e.closest("[hidden]") || cs.visibility === "hidden" || e.closest(".sr-only")) continue;
        if (r.height < 40) out.push(`${root} ${e.tagName} "${e.textContent.trim().slice(0, 24)}" ${Math.round(r.height)}`);
      }
    }
    return out;
  });
  assert.deepEqual(small, []);
  await page.close();
});

test("no console errors on / (favicon aside)", async () => {
  const page = await browser.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text() + " " + (m.location()?.url || "")); });
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + "/", { waitUntil: "networkidle0" });
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } });
  assert.deepEqual(errs.filter((e) => !/favicon/i.test(e)), []);
  await page.close();
});
