// V10.87 · Botanical decorations (leaves, red berries, plum blossom).
// Chromium, synthetic data only — not an iPhone. Checks: where they appear,
// that they are decoration only (hidden from VoiceOver, never tappable, never
// over words or buttons), that they stay out of journal pages / covers /
// Studio, and that both languages and the dark theme are fine.
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
async function boot(browser, lang, { width = 390, theme = "" } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 2000 }, locale: lang, hasTouch: true });
  await context.addInitScript(setup, { lang });
  const page = await context.newPage();
  await page.clock.install({ time: new Date(`${TODAY}T10:00:00`) });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForSelector(".hero");
  await SS.touchStore(page);
  await page.evaluate((d) => {
    const s = JSON.parse(localStorage.getItem("little-days.v1"));
    const book = s.books[0].id;
    for (const day of [3, 10, 16, 17, 18]) {
      const date = `2026-11-${String(day).padStart(2, "0")}`;
      s.entries.push({ id: "e" + day, date, title: "", body: "", bookId: book, layers: [], moments: [{ id: "m" + day, title: "小日子 " + day, body: "", bookId: book, layers: [{ id: "t" + day, kind: "text", text: "今天", x: 50, y: 30, w: 40, h: 10, scale: 1, rotation: 0 }], media: [], createdAt: date + "T09:00:00.000Z" }], createdAt: date + "T09:00:00.000Z" });
    }
    localStorage.setItem("little-days.v1", JSON.stringify(s));
  }, TODAY);
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
// Every decoration: hidden from assistive tech, not tappable, and not over a
// word or a control (checked against the text and buttons of its own card).
const audit = (page) =>
  page.evaluate(() => {
    const words = (root) =>
      [...root.querySelectorAll("h1, h2, b, small, p, span, button, a")]
        .filter((el) => !el.closest(".deco") && el.getBoundingClientRect().width > 0 && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
        .map((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return [...range.getClientRects()].map((r) => ({ r, text: el.textContent.trim().slice(0, 20) }));
        })
        .flat();
    return [...document.querySelectorAll(".deco")].map((el) => {
      const box = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      // The drawn parts (leaves, flowers, twigs), not the empty corners of the box.
      const shapes = [...el.querySelectorAll("path, circle")].map((s) => s.getBoundingClientRect()).filter((r) => r.width * r.height > 4);
      const card = el.parentElement.closest(".stamp-strip, .week-card, .sp-card, .v9-masthead, .hs-colophon") || el.parentElement;
      const hits = [];
      for (const w of words(card.closest(".v9-masthead") ? card.parentElement : card)) {
        for (const s of shapes) {
          const ox = Math.min(s.right, w.r.right) - Math.max(s.left, w.r.left);
          const oy = Math.min(s.bottom, w.r.bottom) - Math.max(s.top, w.r.top);
          if (ox > 2 && oy > 2) hits.push(w.text);
        }
      }
      return { cls: el.getAttribute("class"), parent: el.parentElement.className, hidden: el.getAttribute("aria-hidden") === "true", events: cs.pointerEvents, w: Math.round(box.width), h: Math.round(box.height), opacity: Number(cs.opacity), hits: [...new Set(hits)] };
    });
  });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    for (const lang of ["zh-CN", "en"]) {
      const L = lang === "en" ? "English" : "中文";
      const { page, context, errors } = await boot(browser, lang);
      const home = await audit(page);
      const where = (cls, parent) => home.find((d) => d.cls.includes(cls) && d.parent.includes(parent));
      check(`${L}: Home — branch with berries by the date`, !!where("deco-branch", "v9-masthead"));
      check(`${L}: Home — plum sprig on the stamp card`, !!where("deco-plum", "stamp-strip"));
      check(`${L}: Home — leaf sprig on This week (no photos)`, !!where("deco-leaf", "week-card"));
      check(`${L}: Home — sprig above the colophon`, !!where("deco-leaf", "hs-colophon"));
      check(`${L}: every decoration is drawn at a real size`, home.every((d) => d.w >= 40 && d.h >= 25), JSON.stringify(home.map((d) => [d.cls, d.w, d.h])));
      check(`${L}: decoration only — hidden from VoiceOver, never tappable`, home.every((d) => d.hidden && d.events === "none"));
      check(`${L}: no decoration covers a word or a button on Home`, home.every((d) => d.hits.length === 0), JSON.stringify(home.filter((d) => d.hits.length).map((d) => [d.cls, d.parent, d.hits])));
      // Tapping where the plum sits still opens the stamp card (it is part of the card's button).
      const plum = await page.locator(".stamp-strip > .deco-plum").boundingBox();
      await page.touchscreen.tap(plum.x + plum.width / 2, plum.y + plum.height / 2);
      await page.waitForSelector(".stamps-page");
      await page.waitForTimeout(300);
      const stamps = await audit(page);
      check(`${L}: Stamps page — branch at the top, plum at the bottom`, stamps.some((d) => d.cls.includes("deco-branch") && d.parent === "sp-card") && stamps.some((d) => d.cls.includes("deco-plum") && d.parent === "sp-card"));
      check(`${L}: no decoration covers a word on the Stamps page`, stamps.every((d) => d.hits.length === 0), JSON.stringify(stamps.filter((d) => d.hits.length).map((d) => [d.cls, d.hits])));
      const arrow = await page.evaluate(() => { const a = document.querySelector('.sp-arrow[data-delta="-1"]'); const r = a.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(".sp-arrow") === a; });
      check(`${L}: the month arrows stay on top and tappable`, arrow);
      // Not on journal pages, covers or in the Studio.
      await SS.tapHidden(page, { action: "edit-date", date: TODAY });
      await page.waitForSelector("#phone.in-studio");
      await page.waitForTimeout(500);
      check(`${L}: no decoration in the Journal Studio`, (await page.locator("#phone.in-studio .deco").count()) === 0);
      await SS.leaveStudio(page);
      await SS.goTab(page, "books");
      await page.waitForTimeout(400);
      check(`${L}: no decoration on covers or the shelf`, (await page.locator(".book-cover .deco, .journal-canvas .deco, .flip-page .deco").count()) === 0);
      check(`${L}: the journal data has no decoration in it`, await page.evaluate(() => !/deco-|<svg/.test(localStorage.getItem("little-days.v1") || "")));
      check(`${L} · no page errors`, errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // Narrow screens: still nothing over the words (below 360 the date branch
    // and the week sprig step aside).
    for (const [lang, width] of [["zh-CN", 320], ["en", 320], ["zh-CN", 375], ["en", 375], ["en", 430]]) {
      const { page, context } = await boot(browser, lang, { width });
      const home = await audit(page);
      check(`${lang} @${width}: no decoration covers a word or a button`, home.every((d) => d.hits.length === 0), JSON.stringify(home.filter((d) => d.hits.length).map((d) => [d.cls, d.parent, d.hits])));
      await context.close();
    }
    // The dark theme (cool): quieter.
    const { page, context } = await boot(browser, "zh-CN", { theme: "cool" });
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    const dark = await audit(page);
    check("dark theme: decorations are quieter (opacity ≤ 0.5)", theme === "cool" && dark.length > 0 && dark.every((d) => d.opacity <= 0.5), JSON.stringify([theme, dark.map((d) => d.opacity)]));
    await context.close();
  } finally {
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
