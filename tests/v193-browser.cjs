// V10.89 · Captain Illustrated Asset Pack v1 in the interface.
// Chromium, synthetic data only — not an iPhone. Checks: only the confirmed
// Pack v1 pictures ship (the rest stay staged), each loads, is held at its
// clear size on a 3x screen, is hidden from VoiceOver, stays full colour in
// every theme, and drawing Captain never changes keeper.outfit.
const { chromium } = require("playwright");
const SS = require("./signed-in.cjs");
SS(chromium);
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";

let passed = 0;
const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) {
    passed++;
    console.log(`✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`✗ ${name}${detail ? "  — " + detail : ""}`);
  }
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await context.addInitScript(() => {
    if (localStorage.getItem("v193.boot") === null) {
      localStorage.setItem("v193.boot", "1");
      localStorage.setItem("little-days.with-samples", "0");
      localStorage.setItem("little-days.language", "zh-CN");
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForSelector(".hero");

  const sys = await page.evaluate(async () => {
    const B = await import("./js/botanicals.mjs");
    const manifest = await (await fetch("./captain/manifest.json")).json();
    const shipped = manifest.assets.filter((a) => a.shipped).map((a) => a.name).sort();
    const staged = manifest.assets.filter((a) => !a.shipped).map((a) => a.name);
    const stagedStatus = await Promise.all(staged.map(async (n) => (await fetch(`./captain/${n}.png`)).status));
    const registry = Object.entries(B.CAPTAIN_PACK).map(([name, [w, h, ceil, status]]) => {
      const m = manifest.assets.find((a) => a.name === name);
      return [name, !!m && m.width === w && m.height === h && Math.floor(w / 3) === ceil && m.status === status];
    });
    const box = document.createElement("div");
    box.id = "v193";
    box.innerHTML = ["face", "happy", "sit-up", "peek"].map((k) => B.captainPortrait(k, { size: 400 })).join("") + B.captainPortrait("nonsense", { size: 20 });
    document.body.append(box);
    const imgs = [...box.querySelectorAll("img")];
    await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)))));
    return {
      shipped,
      packKeys: Object.keys(B.CAPTAIN_PACK).sort(),
      stagedStatus,
      registry,
      loaded: imgs.map((i) => [i.dataset.asset, i.naturalWidth > 0, i.src.includes("/captain/")]),
      widths: imgs.map((i) => [i.dataset.asset, i.getBoundingClientRect().width, B.CAPTAIN_PACK[i.dataset.asset][2]]),
      hidden: imgs.every((i) => i.alt === "" && i.getAttribute("aria-hidden") === "true"),
      fallback: imgs[4].dataset.asset,
    };
  });
  check("only the confirmed Pack pictures ship (the code registry = shipped in the manifest)", JSON.stringify(sys.shipped) === JSON.stringify(sys.packKeys) && sys.packKeys.length >= 4, JSON.stringify(sys));
  check("staged Pack v1 pictures are not in the app (404)", sys.stagedStatus.length >= 1 && sys.stagedStatus.every((s) => s === 404), JSON.stringify(sys.stagedStatus));
  check("the code registry matches Public/captain/manifest.json", sys.registry.every(([, ok]) => ok), JSON.stringify(sys.registry));
  check("every portrait loads from captain/", sys.loaded.every(([, ok, dir]) => ok && dir), JSON.stringify(sys.loaded));
  check("a request for more is held at the clear size", sys.widths.every(([, w, ceil]) => w <= ceil + 0.5), JSON.stringify(sys.widths));
  check("hidden from VoiceOver (alt=\"\", aria-hidden)", sys.hidden);
  check("an unknown kind falls back to the calm front bust", sys.fallback === "captain-face");

  for (const theme of ["cool", "minimal"]) {
    const look = await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
      const img = document.querySelector("#v193 img");
      const s = getComputedStyle(img);
      return [s.opacity, s.filter];
    }, theme);
    check(`${theme} theme: Captain stays full colour (character, not decoration)`, look[0] === "1" && look[1] === "none", JSON.stringify(look));
  }

  // Drawing Captain never touches the stored outfit.
  const outfit = await page.evaluate(async () => {
    const s = JSON.parse(localStorage.getItem("little-days.v1") || "{}");
    s.keeper = { ...(s.keeper || {}), outfit: "yarn" };
    localStorage.setItem("little-days.v1", JSON.stringify(s));
    const B = await import("./js/botanicals.mjs");
    B.captainPortrait("happy");
    return JSON.parse(localStorage.getItem("little-days.v1")).keeper.outfit;
  });
  check("keeper.outfit is kept as stored", outfit === "yarn", outfit);
  check("no page errors", errors.length === 0, errors.join(" | "));

  await browser.close();
  console.log(`\nv193: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
