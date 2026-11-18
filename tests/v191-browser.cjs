// V10.86 · Typography v2 — Editorial Serif (storytelling) + Functional Sans
// (interaction). Acceptance A–J in Chromium (not an iPhone; iOS uses its own
// Songti SC, here the Song face is Noto Serif CJK). Synthetic data only.
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
  if (localStorage.getItem("v191.boot") === null) {
    localStorage.setItem("v191.boot", "1");
    localStorage.setItem("little-days.with-samples", "0");
    localStorage.setItem("little-days.labs", "0");
    localStorage.setItem("test.keepJot", "1");
    localStorage.setItem("little-days.language", lang);
  }
}
async function boot(browser, lang, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, locale: lang, hasTouch: true });
  await context.addInitScript(setup, { lang: lang === "en" ? "en" : "zh-CN" });
  const page = await context.newPage();
  await page.clock.install({ time: new Date(`${TODAY}T10:00:00`) });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForSelector(".hero");
  // A kept page today in a handwritten font (the person's own choice) + Captain on.
  await SS.touchStore(page);
  await page.evaluate((d) => {
    const s = JSON.parse(localStorage.getItem("little-days.v1"));
    const book = s.books[0].id;
    s.entries.push({ id: "e-t", date: d, title: "", body: "", bookId: book, layers: [], moments: [{ id: "m-t", title: "在刷视频 等新功能如何", body: "", bookId: book, layers: [{ id: "lt", kind: "text", text: "在刷视频 等新功能如何", fontId: "handwritten", x: 50, y: 30, scale: 1, rotation: 0 }], media: [], titleFont: "handwritten", createdAt: d + "T09:00:00.000Z" }], createdAt: d + "T09:00:00.000Z" });
    s.keeper = { ...(s.keeper || {}), enabled: true, invite: "accepted", animal: "cat", name: "Captain" };
    localStorage.setItem("little-days.v1", JSON.stringify(s));
  }, TODAY);
  await page.reload();
  await page.waitForSelector(".hero .stamp-strip");
  await page.evaluate(() => document.fonts.ready);
  return { page, context, errors };
}
const font = (page, sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { family: cs.fontFamily, weight: Number(cs.fontWeight), size: parseFloat(cs.fontSize), style: cs.fontStyle };
  }, sel);
const token = (page, name) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
const first = (family) => String(family || "").split(",")[0].replace(/"/g, "").trim();

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    for (const lang of ["zh-CN", "en"]) {
      const zh = lang !== "en";
      const { page, context, errors } = await boot(browser, lang);
      const L = zh ? "中文" : "English";
      const hero = await font(page, ".today-prompt");
      const date = await font(page, ".v9-daynum");
      const section = await font(page, ".hs-head h2.hs-title");
      const month = await font(page, ".ss-month");
      const week = await font(page, ".wk-line");
      check(`A ${L}: Home title is the editorial serif (${first(hero.family)} ${hero.weight})`, first(hero.family) === (zh ? "Songti SC" : "LD-elegant") && hero.weight <= 500, JSON.stringify(hero));
      check(`B ${L}: the big date is the high-contrast serif and larger than the title`, first(date.family) === "LD-elegant" && date.size >= hero.size * 2.5 && date.weight <= 500, JSON.stringify(date));
      check(`A ${L}: section / month / week titles are serif, none heavier than 500`, [section, month, week].every((f) => /Songti SC|LD-elegant/.test(first(f.family)) && f.weight <= 500), JSON.stringify([section, month, week].map((f) => `${first(f.family)} ${f.weight}`)));
      if (zh) check("C 中文：宋体标题字号 ≥ 22px，没有变细到难读（字重 500，不用 300）", hero.size >= 22 && section.size >= 22 && month.size >= 22 && hero.weight >= 400);
      else check("D English: headings are upright (not italic) Cormorant, not a classical book face", [hero, section, month, week].every((f) => f.style === "normal" && first(f.family) === "LD-elegant"));
      // E · interaction layer stays sans.
      const sans = await page.evaluate(() => [".home-more", ".home-small b", ".nav-item span", ".ss-count", ".ss-note", ".stamp-strip .v9-kicker", ".keeper-entry", ".settings-gear"].map((s) => { const el = document.querySelector(s); return el ? [s, getComputedStyle(el).fontFamily.split(",")[0].replace(/"/g, "").trim()] : [s, "-"]; }));
      check(`E ${L}: buttons, tabs, small text, counts and the Captain tag stay sans`, sans.every(([, f]) => f === "-apple-system" || f === "-"), JSON.stringify(sans));
      // J · every role reads its token (no page-by-page font-family).
      const roles = [[".today-prompt", "--type-heroTitle-family"], [".hs-head h2.hs-title", "--type-sectionTitle-family"], [".ss-month", "--type-monthTitle-family"], [".wk-line", "--type-journalTitle-family"], [".v9-daynum", "--type-displayDate-family"], [".ss-count", "--type-statLabel-family"], [".ss-note", "--type-caption-family"], [".nav-item span", "--type-navLabel-family"]];
      const mismatch = [];
      for (const [sel, name] of roles) {
        const f = (await font(page, sel))?.family.replace(/\s+/g, " ");
        const v = (await token(page, name)).replace(/\s+/g, " ");
        if (f !== v) mismatch.push(`${sel}: ${f} ≠ ${v}`);
      }
      check(`J ${L}: each role takes its font from the typography tokens`, mismatch.length === 0, mismatch.join(" | "));
      // H · no brush-font fallback anywhere in the interface (pages excluded).
      const brush = await page.evaluate(() => [...document.querySelectorAll("#app *, #navigation *")].filter((el) => !el.closest(".journal-canvas, .flip-page, .story-canvas, .book-cover, .ts-card") && /LD-chinese/.test(getComputedStyle(el).fontFamily)).map((el) => el.className).slice(0, 5));
      check(`H ${L}: no brush font in the interface`, brush.length === 0, JSON.stringify(brush));
      check(`H ${L}: the bundled serif loaded (no fallback to a system face for Latin)`, await page.evaluate(() => document.fonts.check('500 20px "LD-elegant"')));
      // G · the person's own fonts are untouched.
      const own = await page.evaluate(() => { const el = document.querySelector(".ts-card .ts-title"); return el ? { inline: el.style.fontFamily, computed: getComputedStyle(el).fontFamily } : null; });
      check(`G ${L}: today's card keeps the page's own title font (not a UI token)`, own && own.inline && own.computed === own.inline, JSON.stringify(own));
      await page.locator(".ts-card .ts-go, .ts-card .ts-open").first().tap();
      await page.waitForSelector("#phone.in-reader, .day-detail", { timeout: 10000 });
      await page.waitForTimeout(800);
      const layer = await page.evaluate(() => { const el = [...document.querySelectorAll(".layer-text, .text-layer, [data-layer] span")].find((x) => /在刷视频/.test(x.textContent)); return el ? getComputedStyle(el).fontFamily : null; });
      check(`G ${L}: on the page, the handwritten text keeps its font`, /LD-handwritten/.test(layer || ""), layer);
      if (await page.locator("#phone.in-reader").count()) {
        const rt = await font(page, ".reader-name b");
        check(`A ${L}: the reader's book title is the editorial serif`, /Songti SC|LD-elegant/.test(first(rt.family)), JSON.stringify(rt));
        await SS.leaveReader(page);
      }
      // F · the Journal Studio's tools stay sans.
      await SS.tapHidden(page, { action: "edit-date", date: TODAY });
      await page.waitForSelector("#phone.in-studio");
      await page.waitForTimeout(600);
      const studio = await page.evaluate(() => [...document.querySelectorAll(".studio-bar button, .studio-bar b, .tool-dock button, .sv-top button, .sv-top b")].slice(0, 12).map((el) => getComputedStyle(el).fontFamily.split(",")[0].replace(/"/g, "").trim()));
      check(`F ${L}: Journal Studio tools are not serif`, studio.length > 0 && studio.every((f) => !/Songti|LD-elegant|LD-vintage|Georgia|serif/i.test(f) || f === "-apple-system"), JSON.stringify(studio));
      check(`${L} · no page errors`, errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // I · larger text (page zoom 130%, the closest a browser has to Dynamic Type) at 320 wide.
    for (const lang of ["zh-CN", "en"]) {
      const { page, context } = await boot(browser, lang, 320);
      await page.evaluate(() => (document.documentElement.style.zoom = "1.3"));
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const box = (s) => document.querySelector(s)?.getBoundingClientRect();
        const d = box(".v9-daynum"), h = box(".today-prompt"), m = box(".ss-month"), c = box(".ss-count");
        const overlap = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const clipped = [".today-prompt", ".ss-month", ".wk-line", ".hs-head h2.hs-title"].filter((s) => { const el = document.querySelector(s); return el && (el.scrollWidth > el.clientWidth + 2); });
        return { dateTitle: overlap(d, h), monthCount: overlap(m, c), clipped, wide: document.documentElement.scrollWidth > innerWidth * 1.31 };
      });
      check(`I ${lang} @320 + 130% text: date and title don't overlap, titles not cut, no sideways page`, !r.dateTitle && !r.monthCount && r.clipped.length === 0 && !r.wide, JSON.stringify(r));
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
