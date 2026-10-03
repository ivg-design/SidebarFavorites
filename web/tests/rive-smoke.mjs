// Smoke test for public/rive/folder-morph.riv with the @rive-app/canvas UMD runtime.
//   node --test tests/rive-smoke.mjs
// Serves the .riv, the UMD and the wasm from a throwaway local server; no Next build needed.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const CH = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = fileURLToPath(new URL("..", import.meta.url));
const files = {
  "/rive.js": ["node_modules/@rive-app/canvas/rive.js", "text/javascript"],
  "/rive.wasm": ["node_modules/@rive-app/canvas/rive.wasm", "application/wasm"],
  "/folder-morph.riv": ["public/rive/folder-morph.riv", "application/octet-stream"],
};
const html = `<!doctype html><body style="margin:0;background:transparent">
<canvas id="c" width="240" height="240"></canvas>
<script src="/rive.js"></script>
<script>
  rive.RuntimeLoader.setWasmUrl("/rive.wasm");
  window.__state = { loaded: false, error: null };
  window.__r = new rive.Rive({
    src: "/folder-morph.riv", canvas: document.getElementById("c"),
    stateMachines: "Morph SM", autoplay: true, autoBind: true,
    onLoad: () => { window.__r.resizeDrawingSurfaceToCanvas(); window.__state.loaded = true; },
    onLoadError: (e) => { window.__state.error = String(e && e.data || e); },
  });
</script></body>`;

let server, browser, base;
before(async () => {
  server = http.createServer(async (req, res) => {
    if (req.url === "/") { res.setHeader("content-type", "text/html"); return res.end(html); }
    const f = files[req.url];
    if (!f) { res.statusCode = 404; return res.end(); }
    res.setHeader("content-type", f[1]);
    res.end(await readFile(root + f[0]));
  }).listen(0);
  base = `http://localhost:${server.address().port}/`;
  browser = await puppeteer.launch({ executablePath: CH, headless: true, args: ["--no-sandbox"] });
});
after(async () => { await browser?.close(); server?.close(); });

test("folder-morph.riv loads, exposes number `target`, renders pixels after target=3", async () => {
  const page = await browser.newPage();
  await page.goto(base, { waitUntil: "load" });
  await page.waitForFunction(() => window.__state.loaded || window.__state.error, { timeout: 15000 });
  assert.equal(await page.evaluate(() => window.__state.error), null);

  const hasTarget = await page.evaluate(() => {
    const t = window.__r.viewModelInstance?.number("target");
    return !!t && typeof t.value === "number";
  });
  assert.ok(hasTarget, "viewModelInstance.number('target') missing");

  const lit = () => page.evaluate(() => {
    const c = document.getElementById("c");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0 && d[i - 3] > 200) n++; // opaque and light (#F4F4F6), not the dim Rive watermark
    return n;
  });

  await page.evaluate(() => { window.__r.viewModelInstance.number("target").value = 3; });
  await new Promise((r) => setTimeout(r, 1500)); // let the ~450 ms morph settle
  const palettePixels = await lit();
  assert.ok(palettePixels > 5000, `expected a drawn silhouette, got ${palettePixels} opaque pixels`);
  await page.close();
});
