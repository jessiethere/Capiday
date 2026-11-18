// V10.84 · 首次盖章（轻仪式感）S1–S14, Chinese and English.
// The stamp moment comes from a data event (a date's first stamp, after the
// save is stored) — never from drawing a stamp. Clock fixed at Wednesday
// 2026-11-18 10:00. Synthetic data only. Chromium (not an iPhone).
const fs = require("node:fs");
const path = require("node:path");
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
  if (localStorage.getItem("v189.boot") === null) {
    localStorage.setItem("v189.boot", "1");
    localStorage.setItem("little-days.with-samples", "0");
    localStorage.setItem("little-days.labs", "0");
    localStorage.setItem("test.keepJot", "1");
    localStorage.setItem("little-days.language", lang);
  }
  // Every stamp moment shown on this page load, and every light tap asked of
  // the iPhone shell (the page has no real one here).
  window.__moments = [];
  window.__haptics = [];
  window.webkit = { messageHandlers: { littleDaysHaptics: { postMessage: (m) => window.__haptics.push(m) } } };
  const watch = () =>
    new MutationObserver((list) => {
      for (const m of list)
        for (const n of m.addedNodes)
          if (n.id === "stamp-moment") window.__moments.push({ date: n.dataset.date, text: n.querySelector("span")?.textContent || "", at: Date.now() });
    }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.documentElement) watch();
  else document.addEventListener("DOMContentLoaded", watch);
}
async function boot(browser, { lang = "zh-CN", reduced = false, seed = null, arg = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: lang, hasTouch: true, reducedMotion: reduced ? "reduce" : "no-preference" });
  await context.addInitScript(setup, { lang: lang === "en" ? "en" : "zh-CN" });
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
  if (seed) {
    await SS.touchStore(page);
    await page.evaluate(seed, arg);
    await page.reload();
    await page.waitForSelector(".hero");
  }
  return { page, context, errors };
}
const moments = (page) => page.evaluate(() => window.__moments.slice());
const haptics = (page) => page.evaluate(() => window.__haptics.slice());
const read = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")));
const settle = (page) => page.waitForTimeout(700);
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
  await settle(page);
}
async function backfill(page, date, text) {
  // 补记 a chosen date: the calendar's 记一笔 for that day (the Journal Studio), then 保存.
  await SS.tapHidden(page, { action: "edit-date", date });
  await page.waitForSelector("#journal-canvas");
  // A new day opens on its title; a day already kept opens its pages as they are
  // (then 保存 saves that day again — an edit of a kept day).
  if (await page.locator('#journal-canvas [data-inline="title"]').count()) {
    await page.locator('#journal-canvas [data-inline="title"]').first().click();
    await page.keyboard.type(text);
  }
  await page.locator('[data-action="save-entry"]').tap();
  await page.waitForSelector("#phone.in-reader", { timeout: 10000 });
  await settle(page);
}
function seedDays(list) {
  const s = JSON.parse(localStorage.getItem("little-days.v1"));
  const book = s.books[0].id;
  for (const d of list) s.entries.push({ id: `e-${d.date}`, date: d.date, title: d.title, body: "", bookId: book, layers: [], moments: [], createdAt: `${d.date}T10:00:00.000Z` });
  localStorage.setItem("little-days.v1", JSON.stringify(s));
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    // ------------------------------------------------ S1 · S3 · S4 · S8 · S9 (中文)
    {
      const { page, context, errors } = await boot(browser);
      await jot(page, "第一页");
      let m = await moments(page);
      check("S1 中文：今天第一次记录 → 盖章出现一次", m.length === 1 && m[0].date === TODAY, JSON.stringify(m));
      check("S1 中文：文案是「今天，也留下来了。」", m[0]?.text === "今天，也留下来了。", m[0]?.text);
      check("S1 一次很轻的触感（light）", JSON.stringify(await haptics(page)) === JSON.stringify(["light"]), JSON.stringify(await haptics(page)));
      const box = await page.evaluate(() => {
        const el = document.querySelector("#stamp-moment");
        return el ? { events: getComputedStyle(el).pointerEvents, inDialog: Boolean(el.closest("dialog")) } : null;
      });
      check("S1 不挡操作：不需要点、不是弹窗", box && box.events === "none" && !box.inDialog, JSON.stringify(box));
      check("S1 没有游戏化字样", !/打卡|任务|奖励|\+1|连续|补签|streak/i.test(m[0]?.text || ""));
      await page.waitForTimeout(3600);
      check("S1 几秒后自己消失", (await page.locator("#stamp-moment").count()) === 0);
      // S3 · a second page the same day.
      await home(page);
      await jot(page, "第二页");
      check("S3 同一天第二页：不再盖章", (await moments(page)).length === 1);
      // S4 · edit today's page.
      await backfill(page, TODAY, "改一改");
      check("S4 修改已有的一天：不播放", (await moments(page)).length === 1);
      // S9 · Home drawn again, the stamp card, other months.
      await home(page);
      const inked = await page.locator(".stamp-strip .stamp.ink-in").count();
      await page.locator(".stamp-strip").tap();
      await page.waitForSelector(".stamps-page");
      await page.locator('.sp-head [data-action="stamps-month"][data-delta="-1"]').tap().catch(() => {});
      await home(page);
      await home(page);
      check("S9 首页重新显示 / 翻月份：不再播放（首页的章只在第一次显示时落下）", (await moments(page)).length === 1 && (await page.locator(".stamp-strip .stamp.ink-in").count()) === 0, `ink-in first=${inked}`);
      // S8 · restart.
      await page.reload();
      await page.waitForSelector(".hero .stamp-strip");
      await settle(page);
      check("S8 重启 App：不重新播放", (await moments(page)).length === 0);
      check("S1/S3/S4/S8/S9 · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }

    // ------------------------------------------------ S2 (English) · S14
    {
      const { page, context, errors } = await boot(browser, { lang: "en" });
      check("S14 English Home before: “What's worth keeping today?”", (await page.locator(".today-prompt").innerText()).includes("keeping today"));
      await jot(page, "First page");
      const m = await moments(page);
      check("S2 English: first record today → one stamp moment", m.length === 1 && m[0].date === TODAY, JSON.stringify(m));
      check("S2 English: “Another little day, kept.”", m[0]?.text === "Another little day, kept.", m[0]?.text);
      await home(page);
      check("S14 English: “You’ve already captured today.”", (await page.locator(".today-prompt").innerText()) === "You’ve already captured today.");
      check("S14 English: stamp card “This month”", (await page.locator(".stamp-strip .v9-kicker").textContent()).startsWith("This month"));
      const wk = await page.locator(".week-card").innerText();
      check("S14 English: “You kept 1 little day this week.”", wk.includes("You kept 1 little day this week."), wk);
      check("S14 English: “Add another page”", (await page.locator(".home-more").innerText()).includes("Add another page"));
      check("S14 English: no Chinese left on Home's new parts", !/[一-鿿]/.test((await page.locator(".stamp-strip").innerText()) + wk + (await page.locator(".home-done-acts").innerText())));
      // Switch to Chinese: the same Home in Chinese.
      await page.evaluate(() => localStorage.setItem("little-days.language", "zh-CN"));
      await page.reload();
      await page.waitForSelector(".hero .stamp-strip");
      check("S14 切换中文：今天已经记下来了 / 这个月 / 这一周…。 / 再加一页", (await page.locator(".today-prompt").innerText()) === "今天已经记下来了" && (await page.locator(".stamp-strip .v9-kicker").textContent()).startsWith("这个月") && (await page.locator(".week-card").innerText()).includes("这一周，你留下了 1 个小日子。") && (await page.locator(".home-more").innerText()).includes("再加一页"));
      check("S2/S14 · no page errors", errors.length === 0, errors.join(" | "));
      await context.close();
    }

    // ------------------------------------------------ S5 · S6 · S11 · S12 (past dates, delete, empty stamp)
    {
      const { page, context, errors } = await boot(browser, { seed: seedDays, arg: [{ date: "2026-11-10", title: "早就有章" }] });
      await SS.touchStore(page); // the ledger has 11-10 (history: silent)
      check("历史数据写入集章记录时不播放", (await moments(page)).length === 0);
      await backfill(page, "2026-11-12", "补一页");
      let m = await moments(page);
      check("S5 补记从没记过的 11 月 12 日：盖章一次，文案是「11月12日，也留下来了。」", m.length === 1 && m[0].date === "2026-11-12" && m[0].text === "11月12日，也留下来了。", JSON.stringify(m));
      await backfill(page, "2026-11-10", "再补一页");
      check("S6 补记已经有章的日期：不播放", (await moments(page)).length === 1);
      // S11 · delete the only page of 11-12: an empty stamp, no moment.
      await home(page);
      await SS.tapHidden(page, { action: "read-delete", date: "2026-11-12" });
      if (await page.locator("#confirm-dialog[open]").count()) await page.locator("#confirm-ok").click();
      await settle(page);
      await home(page);
      check("S11 删除那天最后一页：变成空章，不播放", (await page.locator('.stamp-strip .stamp.empty[data-date="2026-11-12"]').count()) === 1 && (await moments(page)).length === 1);
      // S12 · a page on that date again: not a first stamp.
      await backfill(page, "2026-11-12", "又写了");
      check("S12 空章之后重新添加页面：不再「首次盖章」", (await moments(page)).length === 1);
      await home(page);
      check("S12 那天又是完整的章", (await page.locator('.stamp-strip .stamp.word[data-date="2026-11-12"]').count()) === 1);
      check("S5/S6/S11/S12 · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }

    // ------------------------------------------------ S10 · restore
    {
      const { page, context, errors } = await boot(browser, { seed: seedDays, arg: [{ date: "2026-11-03", title: "三号" }, { date: "2026-11-16", title: "十六号" }] });
      await page.locator(".settings-gear").click();
      await page.waitForSelector('[data-action="backup"]');
      const [download] = await Promise.all([page.waitForEvent("download"), SS.backupGo(page)]);
      const file = path.join(require("node:os").tmpdir(), `v189-backup-${process.pid}.json`);
      await download.saveAs(file);
      await context.close();
      const other = await boot(browser);
      await other.page.locator(".settings-gear").click();
      await other.page.waitForSelector('[data-action="restore-backup"]');
      await other.page.locator("#backup-input").setInputFiles(file);
      await SS.restoreGo(other.page);
      await settle(other.page);
      await home(other.page);
      check("S10 恢复：恢复出来的日期都有章，但不播放盖章", (await other.page.locator('.stamp-strip .stamp.word[data-date="2026-11-03"]').count()) === 1 && (await moments(other.page)).length === 0, JSON.stringify(await moments(other.page)));
      check("S10 恢复后第一次记今天：照常盖章一次", await (async () => { await jot(other.page, "恢复后"); const m = await moments(other.page); return m.length === 1 && m[0].date === TODAY; })());
      check("S10 · 没有页面错误或系统弹窗", errors.length === 0 && other.errors.length === 0, [...errors, ...other.errors].join(" | "));
      await other.context.close();
    }

    // ------------------------------------------------ S7 · the save does not reach storage
    {
      const { page, context, errors } = await boot(browser);
      await SS.touchStore(page);
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        // Storage is full: LocalStorage refuses the journal and IndexedDB writes fail.
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === "little-days.v1") throw new DOMException("full", "QuotaExceededError");
          return set.call(this, key, value);
        };
        IDBObjectStore.prototype.put = function () {
          throw new DOMException("full", "QuotaExceededError");
        };
      });
      await page.locator('.home-small [data-action="today-write"]').tap();
      await page.waitForSelector(".jot-page");
      await page.locator("#jot-text").fill("存不进去");
      await page.locator(".jot-save").tap();
      await page.waitForTimeout(2500);
      check("S7 保存失败：没有盖章、没有成功文案", (await moments(page)).length === 0 && !(await page.locator("body").innerText()).includes("也留下来了"), JSON.stringify(await moments(page)));
      await context.close();
      // What really reached storage: nothing for today.
      const again = await boot(browser);
      const st = await read(again.page);
      check("S7 重新打开：今天没有章、没有页面", !(st?.recordedDays || {})[TODAY] && !(st?.entries || []).some((e) => e.date === TODAY && !e.isDemo), JSON.stringify(st?.recordedDays));
      await again.context.close();
      void errors;
    }

    // ------------------------------------------------ S13 · Reduce Motion
    {
      const { page, context, errors } = await boot(browser, { reduced: true });
      await page.locator('.home-small [data-action="today-write"]').tap();
      await page.waitForSelector(".jot-page");
      await page.locator("#jot-text").fill("安静一点");
      await page.locator(".jot-save").tap();
      await page.waitForSelector("#stamp-moment", { timeout: 10000 });
      const look = await page.evaluate(() => {
        const box = document.querySelector("#stamp-moment"), seal = box.querySelector(".stamp");
        return { box: getComputedStyle(box).animationName, seal: getComputedStyle(seal).animationName, ink: getComputedStyle(seal, "::after").display, text: box.querySelector("span").textContent };
      });
      check("S13 减弱动态效果：没有按压 / 缩放 / 墨迹扩散，只淡入", look.seal === "stamp-fade" && look.box === "stamp-fade" && look.ink === "none", JSON.stringify(look));
      check("S13 减弱动态效果：章和文案照样清楚出现", look.text === "今天，也留下来了。");
      await home(page);
      const anim = await page.evaluate(() => getComputedStyle(document.querySelector(".stamp-strip .stamp.ink-in") || document.body).animationName);
      check("S13 首页的新章也只淡入", anim === "stamp-fade" || anim === "none", anim);
      check("S13 · 没有页面错误", errors.length === 0, errors.join(" | "));
      await context.close();
    }

    // ------------------------------------------------ S14 · no hard-coded words in the new code
    {
      const src = fs.readFileSync(path.join(__dirname, "../Public/app.js"), "utf8");
      const from = src.indexOf("// ---------- V10.84 · 集章卡 and 这一周 ----------");
      const to = src.indexOf("// ---------- Home · My Library (V10.2) ----------");
      const code = src
        .slice(from, to)
        .split("\n")
        .filter((l) => !l.trim().startsWith("//"))
        .join("\n");
      check("S14 新增界面代码里没有写死的中文（都走 i18n）", from > 0 && to > from && !/[一-鿿]/.test(code));
      const i18n = JSON.parse(fs.readFileSync(path.join(__dirname, "../Packages/LittleDaysCore/Sources/LittleDaysCore/Resources/i18n.json"), "utf8"));
      const keys = ["stamp.firstToday", "stamp.firstDay", "stamp.thisMonth", "week.kicker", "week.line", "home.doneTitle", "home.addPage"];
      check("S14 新文案都有中英文", keys.every((k) => i18n[k]?.zh && i18n[k]?.en));
      const words = keys.map((k) => `${i18n[k].zh} ${i18n[k].en}`).join(" ");
      check("S14 没有游戏化字样（打卡 / 任务 / 奖励 / +1 / streak / Achievement…）", !/打卡|任务完成|奖励|\+1|连续第|补签|streak|check-in|reward|achievement|mission|goal/i.test(words), words);
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
