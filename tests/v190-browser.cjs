// V10.85 · Visual Direction v1, Phase 1 — acceptance A–O (Chromium; not an iPhone).
// Clock fixed at Wednesday 2026-11-18 10:00. Synthetic data only.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const SS = require("./signed-in.cjs");
SS(chromium);
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const TODAY = "2026-11-18";
const ROOT = path.join(__dirname, "..");

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

function setup({ lang, keeper }) {
  if (localStorage.getItem("v190.boot") === null) {
    localStorage.setItem("v190.boot", "1");
    localStorage.setItem("little-days.with-samples", "0");
    localStorage.setItem("little-days.labs", "0");
    localStorage.setItem("test.keepJot", "1");
    localStorage.setItem("little-days.language", lang);
    localStorage.setItem("v190.keeper", keeper ? "1" : "0");
  }
  window.__moments = [];
  const watch = () =>
    new MutationObserver((list) => {
      for (const m of list) for (const n of m.addedNodes) if (n.id === "stamp-moment") window.__moments.push({ date: n.dataset.date, captain: n.dataset.captain, cat: Boolean(n.querySelector(".sm-captain img")) });
    }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) watch();
  else document.addEventListener("DOMContentLoaded", watch);
}
async function boot(browser, { lang = "zh-CN", keeper = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: lang, hasTouch: true });
  await context.addInitScript(setup, { lang: lang === "en" ? "en" : "zh-CN", keeper });
  const page = await context.newPage();
  await page.clock.install({ time: new Date(`${TODAY}T10:00:00`) });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => {
    errors.push("system dialog: " + d.message());
    d.dismiss();
  });
  await page.goto(base);
  await page.waitForSelector(".hero");
  await SS.touchStore(page);
  await page.evaluate((on) => {
    const s = JSON.parse(localStorage.getItem("little-days.v1"));
    if (on) s.keeper = { ...(s.keeper || {}), enabled: true, invite: "accepted", animal: "cat", name: "Captain" };
    localStorage.setItem("little-days.v1", JSON.stringify(s));
  }, keeper);
  await page.reload();
  await page.waitForSelector(".hero");
  return { page, context, errors };
}
const moments = (page) => page.evaluate(() => window.__moments.slice());
async function home(page) {
  if (await page.locator("#phone.in-reader").count()) await SS.leaveReader(page);
  if (await page.locator("#choose-dialog[open]").count()) await page.evaluate(() => document.querySelector("#choose-dialog").close());
  await page.locator('#navigation [data-page="home"]').click();
  await page.waitForSelector(".hero .stamp-strip");
}
async function jot(page, text) {
  await page.locator('.home-small [data-action="today-write"]').tap();
  await page.waitForSelector(".jot-page");
  await page.locator("#jot-text").fill(text);
  await page.locator(".jot-save").tap();
  await page.waitForSelector("#phone.in-reader", { timeout: 10000 });
  await page.waitForTimeout(600);
}
async function backfill(page, date, text) {
  await SS.tapHidden(page, { action: "edit-date", date });
  await page.waitForSelector("#journal-canvas");
  if (await page.locator('#journal-canvas [data-inline="title"]').count()) {
    await page.locator('#journal-canvas [data-inline="title"]').first().click();
    await page.keyboard.type(text);
  }
  await page.locator('[data-action="save-entry"]').tap();
  await page.waitForSelector("#phone.in-reader", { timeout: 10000 });
  await page.waitForTimeout(600);
}
// Contrast of an element's text against the first opaque background behind it.
const contrastOf = (page, sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const bgOf = (n) => {
      for (let x = n; x; x = x.parentElement) {
        const c = rgb(getComputedStyle(x).backgroundColor);
        if (c.length >= 3 && (c.length === 3 || c[3] > 0.9)) return c;
      }
      return [255, 255, 255];
    };
    const L = ([r, g, b]) => [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const a = L(rgb(getComputedStyle(el).color)), b = L(bgOf(el));
    return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
  }, sel);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    // ------------------------------------------------ I · J · K — Captain at the stamp (Chinese)
    {
      const { page, context, errors } = await boot(browser);
      await jot(page, "第一页");
      let m = await moments(page);
      check("I 当月第一枚新章：Captain 一定出现", m.length === 1 && m[0].captain === "first" && m[0].cat, JSON.stringify(m));
      // Same day, more first stamps (补记): 11-02 lucky, 11-03 not, 11-04 lucky, 11-08 lucky (week cap reached).
      for (const [d, txt] of [["2026-11-02", "二号"], ["2026-11-03", "三号"], ["2026-11-04", "四号"], ["2026-11-08", "八号"]]) {
        await home(page);
        await backfill(page, d, txt);
      }
      m = await moments(page);
      const roles = m.map((x) => `${x.date.slice(8)}:${x.captain || "-"}`).join(" ");
      check("J 之后每周最多额外出现两次（02 来、03 不来、04 来、08 本周已满不来）", roles === "18:first 02:extra 03:- 04:extra 08:-", roles);
      const expected = await page.evaluate(async () => {
        const R = await import("./js/captain-stamp.mjs");
        return ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-08"].map((d) => R.lucky(d));
      });
      check("K 规则可测试：是否出现由固定的日期规则决定（不是随机）", JSON.stringify(expected) === JSON.stringify([true, false, true, true]), JSON.stringify(expected));
      const logged = await page.evaluate(() => ({ log: JSON.parse(localStorage.getItem("little-days.captain-stamps") || "{}"), inJournal: (localStorage.getItem("little-days.v1") || "").includes("captain") && /"captain-stamps"|captainStamps/.test(localStorage.getItem("little-days.v1") || "") }));
      check("K 只在本机记 Captain 来过的日期（不写进手帐、不进备份）", Object.keys(logged.log).sort().join() === "2026-11-02,2026-11-04,2026-11-18" && !logged.inJournal, JSON.stringify(logged));
      await page.reload();
      await page.waitForSelector(".hero .stamp-strip");
      await page.waitForTimeout(800);
      check("K 重启 / 重新渲染：不再出现", (await moments(page)).length === 0);
      check("I/J/K · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // ------------------------------------------------ Captain off: never
    {
      const { page, context, errors } = await boot(browser, { keeper: false });
      await jot(page, "没有 Captain");
      const m = await moments(page);
      check("没开 Captain：只有章和那一句，没有 Captain", m.length === 1 && !m[0].captain && !m[0].cat, JSON.stringify(m));
      check("没开 Captain · 没有页面错误", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // ------------------------------------------------ A · D · E · F · G · H (Chinese)
    {
      const { page, context, errors } = await boot(browser);
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("little-days.v1"));
        const book = s.books[0].id;
        for (const [d, t] of [["2026-11-03", "雨"], ["2026-11-16", "旅"], ["2026-11-17", "家"]]) s.entries.push({ id: "e-" + d, date: d, title: t, body: "", bookId: book, layers: [], moments: [], createdAt: d + "T10:00:00.000Z" });
        localStorage.setItem("little-days.v1", JSON.stringify(s));
      });
      await page.reload();
      await page.waitForSelector(".hero .stamp-strip");
      await page.waitForTimeout(2600);
      check("A 中文首页：集章卡 / 十一月 / 已集 3 枚", (await page.locator(".stamp-strip .v9-kicker").textContent()) === "集章卡" && (await page.locator(".ss-month").textContent()) === "十一月" && (await page.locator(".ss-count").textContent()) === "已集 3 枚");
      check("H 首页 Captain：「Captain 在帮你看着这本册子」，不再是「找 Captain」", (await page.locator(".keeper-entry").innerText()).trim() === "Captain 在帮你看着这本册子");
      check("G 这一周：浅竹青卡（不是墨色）", await page.evaluate(() => getComputedStyle(document.querySelector(".week-card")).backgroundColor) === "rgb(232, 238, 227)");
      for (const [sel, name] of [[".week-card .wk-line", "主句"], [".week-card .v9-kicker", "小标题"], [".week-card .wk-meta", "记了几天"], [".week-card .wk-go", "翻开看看"]]) {
        const c = await contrastOf(page, sel);
        check(`G 这一周「${name}」对比度 ≥ 4.5（${c}）`, c >= 4.5);
      }
      const word = await contrastOf(page, ".stamp-strip .stamp.word");
      check(`E 字章：白底朱砂描边，字的对比度 ≥ 4.5（${word}）`, word >= 4.5 && (await page.evaluate(() => { const s = getComputedStyle(document.querySelector(".stamp-strip .stamp.word")); return s.borderTopStyle === "solid" && s.backgroundColor !== "rgb(194, 84, 74)"; })));
      for (const [sel, name] of [[".ss-count", "已集 N 枚"], [".ss-note", "说明"], [".ss-go", "看整张"]]) {
        const c = await contrastOf(page, sel);
        check(`E 集章卡「${name}」对比度 ≥ 4.5（${c}）`, c >= 4.5);
      }
      const solid = await page.evaluate(() => [...document.querySelectorAll("#app *")].filter((el) => getComputedStyle(el).backgroundColor === "rgb(194, 84, 74)").map((el) => el.className));
      check("F 朱砂没有大面积使用：首页没有实心朱砂块（章是描边）", solid.length === 0, JSON.stringify(solid));
      const reds = await page.evaluate(() => [...document.querySelectorAll("#app .hero button, #app .hero .primary, .nav-item, .settings-gear i")].filter((el) => /rgb\((194, 84, 74|169, 72, 58)\)/.test(getComputedStyle(el).backgroundColor)).length);
      check("F 朱砂不用于按钮 / 主 CTA / 导航", reds === 0);
      // D · the stamp card page.
      await page.locator(".stamp-strip").tap();
      await page.waitForSelector(".stamps-page");
      check("D 详情页：小字「月令集章」，大标题「十一月」，年份另起", (await page.locator(".sp-head .v9-kicker").textContent()) === "月令集章" && (await page.locator(".sp-head h1").textContent()) === "十一月" && (await page.locator(".sp-year").textContent()) === "2026");
      // H · Captain's panel: today first, chat below.
      await home(page);
      await page.locator(".keeper-entry").tap();
      await page.waitForSelector("#choose-dialog[open] .kp");
      const panel = await page.evaluate(() => {
        const d = document.querySelector("#choose-dialog .kp");
        const pos = (sel) => { const el = d.querySelector(sel); return el ? el.getBoundingClientRect().top : -1; };
        return { tab: d.querySelector('.kp-tab[aria-selected="true"]')?.textContent, look: pos(".kp-lookback"), card: pos(".cp-acts, .kp-card, .keeper-acts"), say: pos("[data-keeper-say]"), label: d.querySelector(".kp-chat-label")?.textContent || "" };
      });
      check("H Captain 面板：第一页是「今天」，先提醒和回看，聊天在下面", panel.tab === "今天" && panel.look > 0 && panel.say > panel.look && /说几句/.test(panel.label), JSON.stringify(panel));
      check("A/D/E/F/G/H · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // ------------------------------------------------ B · C (English)
    {
      const { page, context, errors } = await boot(browser, { lang: "en" });
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("little-days.v1"));
        s.entries.push({ id: "e-en", date: "2026-11-16", title: "Walk home", body: "", bookId: s.books[0].id, layers: [], moments: [], createdAt: "2026-11-16T10:00:00.000Z" });
        localStorage.setItem("little-days.v1", JSON.stringify(s));
      });
      await page.reload();
      await page.waitForSelector(".hero .stamp-strip");
      check("C English Home: This month / November / 1 stamp", (await page.locator(".stamp-strip .v9-kicker").textContent()) === "This month" && (await page.locator(".ss-month").textContent()) === "November" && (await page.locator(".ss-count").textContent()) === "1 stamp");
      check("B English Captain: “Captain is keeping an eye on your little book”", (await page.locator(".keeper-entry").innerText()).replace(/\s+/g, " ").trim() === "Captain is keeping an eye on your little book");
      check("B English This week: “You kept 1 little day this week.”", (await page.locator(".week-card").innerText()).includes("You kept 1 little day this week."));
      const zhLeft = await page.evaluate(() => [".stamp-strip", ".week-card", ".keeper-entry"].map((s) => document.querySelector(s)?.textContent || "").join(" "));
      check("B no Chinese in the English Home parts", !/[一-鿿]/.test(zhLeft), zhLeft);
      await page.locator(".stamp-strip").tap();
      await page.waitForSelector(".stamps-page");
      check("C stamp page: kicker Stamps, title November, year below", (await page.locator(".sp-head .v9-kicker").textContent()) === "Stamps" && (await page.locator(".sp-head h1").textContent()) === "November" && (await page.locator(".sp-year").textContent()) === "2026");
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      check("B/C no sideways scroll at 390", width <= 390, String(width));
      check("B/C · no page errors", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // ------------------------------------------------ L · default covers in both languages
    for (const lang of ["zh-CN", "en"]) {
      const { page, context, errors } = await boot(browser, { lang, keeper: false });
      await SS.menu(page, "books");
      await page.waitForTimeout(300);
      await page.locator('.page-top [data-action="new-book"]').tap();
      await page.waitForSelector("#form-dialog[open] .book-main");
      const covers = await page.evaluate(() =>
        ["capiday-travel", "capiday-everyday", "capiday-captain"].map((id) => {
          const b = document.querySelector(`#form-dialog [data-action="cover-template"][data-template="${id}"]`);
          const c = b?.querySelector(".book-cover");
          const r = c?.getBoundingClientRect();
          return { id, label: b?.querySelector(":scope > span")?.textContent || "", title: Boolean(c?.querySelector(".cv-title")), seal: Boolean(c?.querySelector(".cv-seal")), fits: c ? c.scrollWidth <= Math.ceil(r.width) + 1 : false };
        }),
      );
      const labels = covers.map((c) => c.label).join(" / ");
      const want = lang === "en" ? "Travel Notes / Everyday / Captain" : "旅行笔记 / 日常 / Captain";
      check(`L ${lang}: three Capiday covers in the featured row (${labels})`, labels === want, labels);
      check(`L ${lang}: each has a title and a tiny seal, nothing overflows`, covers.every((c) => c.title && c.seal && c.fits), JSON.stringify(covers));
      await page.locator('#form-dialog [data-action="cover-template"][data-template="capiday-captain"]').tap();
      check(`L ${lang}: choosing one shows it on the large preview`, (await page.locator("#form-dialog .cover-capiday-captain").count()) >= 1);
      check(`L ${lang} · no page errors`, errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // ------------------------------------------------ M · N — nothing for weather / 今天一个字
    {
      const files = ["Public/app.js", ...fs.readdirSync(path.join(ROOT, "Public/js")).map((f) => `Public/js/${f}`)];
      const src = files.map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
      check("M 没有天气 / 定位：不读 geolocation，不调天气接口", !/geolocation|getCurrentPosition|weather\s*api|openweather|api\.weather/i.test(src));
      const plist = fs.readFileSync(path.join(ROOT, "Native/LittleDays.xcodeproj/project.pbxproj"), "utf8") + (fs.existsSync(path.join(ROOT, "Native/App/Info.plist")) ? fs.readFileSync(path.join(ROOT, "Native/App/Info.plist"), "utf8") : "");
      check("M iOS 没有新增定位权限", !/NSLocation/i.test(plist));
      const i18n = fs.readFileSync(path.join(ROOT, "Packages/LittleDaysCore/Sources/LittleDaysCore/Resources/i18n.json"), "utf8");
      check("N 「今天一个字」没有在这版实现（只在 Phase 3 backlog）", !/今天一个字|todayChar|dayChar|one word of the day/i.test(src + i18n));
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
