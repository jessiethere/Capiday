// V10.88 · Capiday Botanical Decorative System (V10.87 was its first sketch).
// Chromium, synthetic data only — not an iPhone. Checks the rules:
// assets come from one module and tokens; decoration only (hidden from
// VoiceOver, never tappable, never over words or controls); density (Home one
// small sprig, stamp card one corner, stamp page one subtle corner, fewer
// plants with many photos, a little more when empty); kept away from
// interaction surfaces; no cinnabar on plants; both languages; themes.
const { chromium } = require("playwright");
const SS = require("./signed-in.cjs");
SS(chromium);
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const TODAY = "2026-11-18";

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
function setup({ lang }) {
  if (localStorage.getItem("v192.boot") === null) {
    localStorage.setItem("v192.boot", "1");
    localStorage.setItem("little-days.with-samples", "0");
    localStorage.setItem("little-days.labs", "0");
    localStorage.setItem("little-days.language", lang);
  }
}
const textLayer = (id) => ({ id, kind: "text", text: "今天", x: 50, y: 30, w: 40, h: 10, scale: 1, rotation: 0 });
const photoLayer = (id, ref) => ({ id, kind: "photo", text: "", mediaRef: ref, x: 50, y: 50, w: 40, h: 30, rotation: 0, scale: 1 });
async function boot(browser, lang, { width = 390, theme = "", days = [3, 10, 16, 17, 18], todayPhotos = 0 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 2000 }, locale: lang, hasTouch: true });
  await context.addInitScript(setup, { lang });
  const page = await context.newPage();
  await page.clock.install({ time: new Date(`${TODAY}T10:00:00`) });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForSelector(".hero");
  await SS.touchStore(page);
  await page.evaluate(({ days, todayPhotos, text, photo }) => {
    const mk = eval(`(${text})`);
    const ph = eval(`(${photo})`);
    const s = JSON.parse(localStorage.getItem("little-days.v1"));
    const book = s.books[0].id;
    for (const day of days) {
      const date = typeof day === "string" ? day : `2026-11-${String(day).padStart(2, "0")}`;
      const layers = date === "2026-11-18" && todayPhotos ? Array.from({ length: todayPhotos }, (_, i) => ph("p" + i, ["photo:latte-art", "photo:brunch", "photo:holiday-pool", "photo:workday-coffee"][i % 4])) : [mk("t" + date)];
      s.entries.push({ id: "e" + date, date, title: "", body: "", bookId: book, layers: [], moments: [{ id: "m" + date, title: "小日子", body: "", bookId: book, layers, media: [], createdAt: date + "T09:00:00.000Z" }], createdAt: date + "T09:00:00.000Z" });
    }
    localStorage.setItem("little-days.v1", JSON.stringify(s));
  }, { days, todayPhotos, text: textLayer.toString(), photo: photoLayer.toString() });
  if (theme) {
    await page.reload();
    await page.waitForSelector(".hero");
    await SS.tapHidden(page, { action: "theme", themeId: theme });
  }
  await page.reload();
  await page.waitForSelector(".hero .stamp-strip");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return { page, context, errors };
}
// Every decoration on screen: hidden, not tappable, not over a word or a control.
const audit = (page) =>
  page.evaluate(() => {
    const words = (root) =>
      [...root.querySelectorAll("h1, h2, b, small, p, span, button, a")]
        .filter((el) => !el.closest(".bot") && el.getBoundingClientRect().width > 0 && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
        .flatMap((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return [...range.getClientRects()].map((r) => ({ r, text: el.textContent.trim().slice(0, 20) }));
        });
    return [...document.querySelectorAll("#app .bot")]
      .filter((el) => !el.closest(".book-cover"))
      .map((el) => {
        const box = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const shapes = el.tagName === "IMG" ? [box] : [...el.querySelectorAll("path, circle, ellipse, rect")].map((s) => s.getBoundingClientRect()).filter((r) => r.width * r.height > 4);
        const card = el.closest(".stamp-strip, .sp-card, .stamps-page, .v9-masthead") || el.parentElement;
        const scope = card.classList.contains("v9-masthead") ? card.parentElement : card;
        const hits = [];
        for (const w of words(scope)) for (const s of shapes) if (Math.min(s.right, w.r.right) - Math.max(s.left, w.r.left) > 2 && Math.min(s.bottom, w.r.bottom) - Math.max(s.top, w.r.top) > 2) hits.push(w.text);
        return { cls: el.getAttribute("class"), parent: el.parentElement.className, hidden: el.getAttribute("aria-hidden") === "true", focusable: el.getAttribute("focusable"), events: cs.pointerEvents, w: Math.round(box.width), h: Math.round(box.height), opacity: Number(cs.opacity), hits: [...new Set(hits)], visible: box.width > 0 && cs.display !== "none" };
      })
      .filter((d) => d.visible);
  });
const kinds = (list) => list.map((d) => (d.cls.match(/bot-(corner|sprig|berry|blossom|vignette)/) || [])[1]);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    // 0 · The asset system itself (module, tokens).
    {
      const { page, context } = await boot(browser, "zh-CN");
      const sys = await page.evaluate(async () => {
        const B = await import("./js/botanicals.mjs");
        const root = getComputedStyle(document.documentElement);
        const tokens = ["paper", "warmGray", "bamboo", "sage", "lightLeaf", "branch", "fruit", "blossom", "seal"].map((k) => [k, root.getPropertyValue("--bot-" + k).trim()]);
        const plants = ["corner", "sprig", "berry", "blossom"].map((k) => B.botanical(k)).join("");
        const svg = plants;
        // Captain scenes and cover art: small PNGs that must load.
        const pics = [...B.CAPTAIN_POSES.map((p) => B.captainVignette({ pose: p })), ...["travel", "everyday", "captain"].map((k) => B.coverArt(k))];
        const box = document.createElement("div");
        box.style.cssText = "position:fixed;left:0;top:0;width:300px;opacity:.01";
        box.innerHTML = pics.join("");
        document.body.append(box);
        const imgs = [...box.querySelectorAll("img")];
        imgs.forEach((i) => (i.loading = "eager"));
        await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
        const loaded = imgs.map((i) => [i.getAttribute("src"), i.naturalWidth > 0, i.getAttribute("alt") === "" && i.getAttribute("aria-hidden") === "true", getComputedStyle(i).mixBlendMode]);
        const sizes = await Promise.all(imgs.map(async (i) => (await (await fetch(i.getAttribute("src"))).arrayBuffer()).byteLength));
        box.remove();
        return {
          tokens,
          hex: /#[0-9a-f]{3,8}\b/i.test(svg),
          raster: /<image|data:image\/png|\.png|\.jpg/i.test(svg),
          sealOnPlants: /class="bs/.test(plants),
          options: [B.botanical("sprig", { size: "s", place: "bl", flip: true, tone: "quiet" }).match(/class="([^"]+)"/)[1]],
          bytes: svg.length,
          loaded,
          sizes,
          poses: B.CAPTAIN_POSES,
          plans: ["home", "stampCard", "stamps"].map((s) => [s, B.withinDensity(B.decorPlan(s, { empty: true })), B.decorPlan(s, { empty: true }).length]),
          busyHome: B.decorPlan("home", { photos: 6 }).length,
          busyStamps: B.decorPlan("stamps", { photoStamps: 12 })[0].size,
        };
      });
      check("system: botanical color tokens are defined (--bot-*)", sys.tokens.every(([, v]) => /^#[0-9A-F]{6}$/i.test(v)), JSON.stringify(sys.tokens));
      check("system: plants use only token classes (no literal colors) and no raster images", !sys.hex && !sys.raster);
      check("system: Captain scenes (4) and cover art (3) load, are hidden from VoiceOver, and blend into paper (multiply; the travel blossom is a cut-out)", sys.loaded.length === 7 && sys.loaded.every(([, ok, quiet]) => ok && quiet) && sys.loaded.filter(([src]) => !/travel/.test(src)).every(([, , , blend]) => blend === "multiply"), JSON.stringify(sys.loaded));
      check(`system: pictures stay small (largest ${Math.max(...sys.sizes)} bytes)`, sys.sizes.every((n) => n < 40000), JSON.stringify(sys.sizes));
      check("system: cinnabar (seal) never on plants — only in the Captain vignette's seal", !sys.sealOnPlants);
      check("system: size / placement / flip / tone are options", /bot-s/.test(sys.options[0]) && /bot-at-bl/.test(sys.options[0]) && /bot-flip/.test(sys.options[0]) && /bot-quiet/.test(sys.options[0]), sys.options[0]);
      check(`system: light — every plant together is ${sys.bytes} bytes of SVG`, sys.bytes < 20000);
      check("system: Captain vignette has four poses (sleep, sit, ready, stamp)", JSON.stringify(sys.poses) === JSON.stringify(["sleep", "sit", "ready", "stamp"]));
      check("system: every surface plan keeps the density rules", sys.plans.every(([, ok]) => ok), JSON.stringify(sys.plans));
      check("system: many photos → Home drops its sprig; a busy stamp month → a smaller corner", sys.busyHome === 0 && sys.busyStamps === "xs");
      await context.close();
    }
    for (const lang of ["zh-CN", "en"]) {
      const L = lang === "en" ? "English" : "中文";
      const { page, context, errors } = await boot(browser, lang);
      const home = await audit(page);
      check(`${L} Home: one small sprig by the date + one berry corner on the stamp card, nothing else`, JSON.stringify(kinds(home).sort()) === JSON.stringify(["berry", "sprig"]) && home.some((d) => d.parent === "v9-masthead" && /bot-s\b/.test(d.cls)) && home.some((d) => /stamp-strip/.test(d.parent)), JSON.stringify(home.map((d) => [d.cls, d.parent])));
      check(`${L} Home: the week card, Captain, books and colophon stay clean`, (await page.locator(".week-card .bot, .keeper-home .bot, .home-book .bot, .hs-colophon .bot, .home-small .bot").count()) === 0);
      check(`${L}: decoration only — hidden from VoiceOver, not focusable, never tappable`, home.every((d) => d.hidden && d.focusable === "false" && d.events === "none"));
      check(`${L}: no plant covers a word or a button on Home`, home.every((d) => d.hits.length === 0), JSON.stringify(home.filter((d) => d.hits.length).map((d) => [d.cls, d.hits])));
      const strip = await page.locator(".stamp-strip > .bot").boundingBox();
      await page.touchscreen.tap(strip.x + strip.width / 2, strip.y + strip.height / 2);
      await page.waitForSelector(".stamps-page");
      await page.waitForTimeout(300);
      const sp = await audit(page);
      check(`${L} stamp page: one very subtle corner (no berries, no flowers) + paper grain`, JSON.stringify(kinds(sp)) === JSON.stringify(["corner"]) && /bot-quiet/.test(sp[0].cls) && (await page.locator(".sp-card.paper-grain").count()) === 1 && (await page.locator(".sp-card .bot .bf, .sp-card .bot .bp").count()) === 0);
      check(`${L} stamp page: no plant covers a word; the month arrows stay on top`, sp.every((d) => d.hits.length === 0) && (await page.evaluate(() => { const a = document.querySelector('.sp-arrow[data-delta="-1"]'); const r = a.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(".sp-arrow") === a; })), JSON.stringify(sp.map((d) => d.hits)));
      // Interaction surfaces stay clean.
      await SS.tapHidden(page, { action: "edit-date", date: TODAY });
      await page.waitForSelector("#phone.in-studio");
      await page.waitForTimeout(400);
      check(`${L}: no plants in the Journal Studio (toolbar, page, panels)`, (await page.locator("#phone.in-studio .bot").count()) === 0);
      await SS.leaveStudio(page);
      await SS.goTab(page, "books");
      await page.waitForTimeout(300);
      check(`${L}: no plants on the shelf outside the covers, nor in the tab bar`, (await page.locator("#app .bot:not(.book-cover .bot), #navigation .bot").count()) === 0);
      check(`${L}: the journal data has no decoration in it`, await page.evaluate(() => !/bot-|<svg/.test(localStorage.getItem("little-days.v1") || "")));
      check(`${L} · no page errors`, errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // Many photos on the first screen → no sprig by the date (content first).
    {
      const { page, context } = await boot(browser, "zh-CN", { todayPhotos: 4 });
      check("many photos today → Home leaves out the date sprig", (await page.locator(".v9-masthead .bot").count()) === 0);
      await context.close();
    }
    // An empty month (stamps only last month) → Captain at a seal, still one corner.
    for (const lang of ["zh-CN", "en"]) {
      const { page, context } = await boot(browser, lang, { days: ["2026-10-08", "2026-10-09"] });
      await SS.tapHidden(page, { action: "stamps-open" });
      await page.waitForSelector(".stamps-page");
      await page.waitForTimeout(300);
      const sp = await audit(page);
      check(`${lang} empty month: Captain vignette (sit) + one corner; nothing covers the words`, JSON.stringify(kinds(sp).sort()) === JSON.stringify(["corner", "vignette"]) && (await page.locator(".sp-empty-art .bot-vignette.pose-sit").count()) === 1 && sp.every((d) => d.hits.length === 0), JSON.stringify(sp.map((d) => [d.cls, d.hits])));
      await context.close();
    }
    // Narrow / wide screens.
    for (const [lang, width] of [["zh-CN", 320], ["en", 320], ["zh-CN", 375], ["en", 375], ["en", 430]]) {
      const { page, context } = await boot(browser, lang, { width });
      const home = await audit(page);
      check(`${lang} @${width}: no plant covers a word or a button`, home.every((d) => d.hits.length === 0), JSON.stringify(home.filter((d) => d.hits.length).map((d) => [d.cls, d.hits])));
      await context.close();
    }
    // My Books: Capiday's three covers use the same assets.
    {
      const { page, context } = await boot(browser, "en");
      const covers = await page.evaluate(async () => {
        const { coverHTML } = await import("./js/personal-ui.mjs");
        const catalog = await (await fetch("./shared/library.json")).json();
        const tokens = await (await fetch("./shared/design-tokens.json")).json();
        const ctx = { catalog, tokens, media: { resolve: () => "" }, t: (k) => k, language: "en" };
        return ["capiday-travel", "capiday-everyday", "capiday-captain"].map((tpl) => {
          const html = coverHTML({ id: "x", title: "Travel Notes", coverTemplate: tpl }, ctx);
          return [tpl, (html.match(/bot-cover-(\w+)/) || [])[1], /cv-seal/.test(html), /paper-grain/.test(html)];
        });
      });
      check("covers: Travel Notes = white blossom + seal; Everyday = a faint sprig + seal + paper; Captain = Captain looking up + seal + paper", JSON.stringify(covers) === JSON.stringify([["capiday-travel", "travel", true, false], ["capiday-everyday", "everyday", true, true], ["capiday-captain", "captain", true, true]]), JSON.stringify(covers));
      await context.close();
    }
    // Themes: dark quieter, minimal paler.
    for (const [theme, max] of [["cool", 0.45], ["minimal", 0.6]]) {
      const { page, context } = await boot(browser, "zh-CN", { theme });
      const list = await audit(page);
      check(`${theme} theme: plants are quieter (opacity ≤ ${max})`, list.length > 0 && list.every((d) => d.opacity <= max), JSON.stringify(list.map((d) => d.opacity)));
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
