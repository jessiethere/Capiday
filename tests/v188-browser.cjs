// V10.84 · 集章卡 / 这一周 / 首页一个主要动作 — acceptance A–R in the app.
// The clock is fixed at Wednesday 2026-11-18 10:00 (week = Mon 16 – Sun 22).
// Synthetic data only. Chromium. Labs off (as a new user sees it).
// The stamp rules themselves (Store.update, migration, restore) are also
// unit-tested in tests/v188-stamps.test.mjs.
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

function settings({ lang, hide }) {
  // Runs before the app: the defaults a new install has (no samples, Labs
  // off), 快速记录 kept as itself, and the language asked for.
  if (localStorage.getItem("v188.boot") === null) {
    localStorage.setItem("v188.boot", "1");
    localStorage.setItem("little-days.with-samples", "0");
    localStorage.setItem("little-days.labs", "0");
    localStorage.setItem("test.keepJot", "1");
    localStorage.setItem("little-days.language", lang);
    if (hide) localStorage.setItem("little-days.hide-today", "1");
  }
}
async function boot(browser, { lang = "zh-CN", hide = false, seed = null, arg = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: lang, hasTouch: true });
  await context.addInitScript(settings, { lang: lang === "en" ? "en" : "zh-CN", hide });
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
const read = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")));
// A change through the app (the store's one write path): add and remove a plan.
const touch = async (page) => {
  await SS.touchStore(page);
};
const home = async (page) => {
  if (await page.locator("#phone.in-reader").count()) await SS.leaveReader(page);
  if (await page.locator("#choose-dialog[open]").count()) await page.evaluate(() => document.querySelector("#choose-dialog").close());
  await page.locator('#navigation [data-page="home"]').click();
  await page.waitForSelector(".hero .stamp-strip");
};
const strip = (page) =>
  page.evaluate(() => {
    const el = document.querySelector(".stamp-strip");
    const stamps = {};
    for (const s of el.querySelectorAll(".stamp[data-date]")) stamps[s.dataset.date] = { cls: s.className.replace(/^stamp\s*/, ""), img: Boolean(s.querySelector("img")), text: s.textContent };
    return { count: el.querySelector(".ss-count").textContent, text: el.textContent, stamps };
  });
const h1 = (page) => page.locator(".today-prompt").innerText();
// Synthetic pages.
function seedDays(days) {
  const s = JSON.parse(localStorage.getItem("little-days.v1"));
  const book = s.books[0].id;
  const L = (id, text) => ({ id, kind: "text", text, x: 0.5, y: 0.5, scale: 1, rotation: 0 });
  for (const d of days) {
    const extra = d.moments ? { moments: d.moments.map((m) => ({ id: m.id, title: m.title, body: "", layers: [], media: [], bookId: m.book || book, createdAt: d.createdAt || `${d.date}T10:00:00.000Z` })) } : {};
    s.entries.push({ id: d.id || `e-${d.date}`, date: d.date, title: d.title || "", body: "", bookId: book, moments: [], layers: d.text ? [L(`l-${d.date}`, d.text)] : [], createdAt: d.createdAt || `${d.date}T10:00:00.000Z`, ...extra });
  }
  if (days.books) s.books.push(...days.books);
  localStorage.setItem("little-days.v1", JSON.stringify(s));
}
async function writeJot(page, text) {
  await page.waitForSelector(".jot-page");
  await page.locator("#jot-text").fill(text);
  await page.locator(".jot-save").tap();
  await page.waitForSelector("#phone.in-reader", { timeout: 10000 });
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    // ---------------------------------------------------------------- N · Home, nothing kept today
    {
      const { page, context, errors } = await boot(browser);
      check("N 未记录：标题是今天有什么值得记录", (await h1(page)) === "今天有什么值得记录？");
      check("N 未记录：只有一个大的主按钮（选今天的照片）", (await page.locator(".v9-hero .v9-cta").count()) === 1 && (await page.locator(".home-done-acts").count()) === 0);
      const small = await page.locator(".home-small .today-tile").evaluateAll((els) => els.map((e) => e.dataset.action));
      check("N 未记录：其他记法收成一行小按钮（自己写 / 手绘 / 更多方式 / 补记昨天）", JSON.stringify(small) === JSON.stringify(["today-write", "today-draw", "quick-open", "backfill"]), JSON.stringify(small));
      const s = await strip(page);
      check("N 未记录：集章条显示这个月还没有章，今天是空的虚线圈", s.count === "这个月还没有章" && s.stamps[TODAY].cls.includes("none") && s.stamps[TODAY].cls.includes("today"), JSON.stringify(s.stamps[TODAY]));
      check("N 未记录：一周没记就不出现这一周卡片", (await page.locator(".week-card").count()) === 0);
      check("N 首页没有连续打卡 / 断签 / 积分 / 等级字样", !/连续|断签|补签|积分|等级|排行/.test(await page.locator(".hero").innerText()));
      // Order: main action, then (secondary row), stamps, week — 主按钮在集章之前.
      const order = await page.evaluate(() => {
        const y = (sel) => document.querySelector(sel)?.getBoundingClientRect().top ?? -1;
        return { cta: y(".v9-cta"), small: y(".home-small"), stamps: y(".stamp-strip") };
      });
      check("N 层级：主按钮在上，小按钮其次，集章条在下", order.cta < order.small && order.small < order.stamps, JSON.stringify(order));
      // R · 手绘 is still one tap away.
      await page.locator('.home-small [data-action="today-draw"]').tap();
      await page.waitForSelector("#draw-dialog[open] .draw-canvas");
      check("R 手绘：首页小按钮能直接打开手绘板", true);
      await page.evaluate(() => document.querySelector("#draw-dialog").close());
      check("N · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }

    // ---------------------------------------------------------------- A · B · O · first record of the day, then more pages
    {
      const { page, context, errors } = await boot(browser);
      const before = await read(page).catch(() => null);
      await page.locator('.home-small [data-action="today-write"]').tap();
      await writeJot(page, "第一页，天很好");
      await home(page);
      let s = await strip(page);
      let st = await read(page);
      check("A 第一次记录：今天盖上一枚章（第一个字）", s.stamps[TODAY].cls === "word" && s.stamps[TODAY].text === "第", JSON.stringify(s.stamps[TODAY]));
      check("A 第一次记录：这个月已集 1 枚，集章记录里有今天", s.count === "已集 1 枚" && Object.keys(st.recordedDays || {}).join() === TODAY, JSON.stringify(st.recordedDays));
      check("O 已记录：标题变成今天已经记下来了", (await h1(page)) === "今天已经记下来了");
      check("O 已记录：先看到今天这一页，再加一页是主按钮", (await page.locator(".hero .ts-card").count()) === 1 && (await page.locator('.home-done-acts .home-more[data-action="today-photos"]').count()) === 1 && (await page.locator(".v9-hero").count()) === 0);
      const ids1 = st.entries.map((e) => [e.id, ...(e.moments || []).map((m) => m.id)].join("/")).join();
      // B · a second page the same day: still one stamp.
      await page.locator('.home-small [data-action="today-write"]').tap();
      await writeJot(page, "第二页");
      await home(page);
      s = await strip(page);
      st = await read(page);
      const pages = st.entries.filter((e) => e.date === TODAY).flatMap((e) => e.moments || []).length;
      check("B 同一天多页：还是 1 枚（今天有 2 页）", s.count === "已集 1 枚" && pages === 2 && Object.keys(st.recordedDays).length === 1, `${s.count} pages=${pages}`);
      const ids2 = st.entries.map((e) => [e.id, ...(e.moments || []).map((m) => m.id)].filter((x, i) => i === 0 || ids1.includes(x)).join("/")).join();
      check("B 盖章不改已有页面的 ID", ids1.split(",").every((x) => ids2.includes(x.split("/")[0])));
      // O · 这一周 appears with the first day of the week.
      const wk = await page.locator(".week-card").innerText();
      check("Q 这一周卡片：这一周，你留下了 1 个小日子（不是 1/7）", wk.includes("这一周，你留下了 1 个小日子") && !/\d\s*\/\s*7/.test(wk), wk);
      // R · 手绘 also from the recorded state.
      await page.locator('.home-small [data-action="today-draw"]').tap();
      await page.waitForSelector("#draw-dialog[open] .draw-canvas");
      check("R 手绘：已记录状态下也能打开", true);
      await page.evaluate(() => document.querySelector("#draw-dialog").close());
      check("A/B/O · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      void before;
      await context.close();
    }

    // ---------------------------------------------------------------- C · 补记昨天 (through the app)
    {
      const { page, context, errors } = await boot(browser);
      await page.locator(".home-small .backfill-link").tap();
      await page.waitForSelector("#choose-dialog[open] .quick-sheet");
      await page.locator('.quick-sheet [data-action="quick-way"][data-way="write"]').tap();
      await page.locator('.quick-sheet [data-action="quick-start"], .quick-sheet [data-action="quick-more"]').first().tap();
      // 补记 opens that day's page in the Journal Studio (written, then 保存).
      await page.waitForSelector('#journal-canvas [data-inline="title"]');
      await page.keyboard.type("昨天忘了记");
      await page.locator('[data-action="save-entry"]').tap();
      await page.waitForSelector("#phone.in-reader", { timeout: 10000 });
      await home(page);
      const s = await strip(page);
      const st = await read(page);
      check("C 补记：盖在手帐日期（昨天 11 月 17 日），不是今天", s.stamps["2026-11-17"].cls === "word" && s.stamps[TODAY].cls.includes("none") && Object.keys(st.recordedDays).join() === "2026-11-17", JSON.stringify(st.recordedDays));
      check("C 补记：和正常的章一样（没有补字、没有别的颜色或虚线）", s.stamps["2026-11-17"].text === "昨" && !s.text.includes("补"), s.stamps["2026-11-17"].text);
      check("C 补记：今天仍是未记录状态", (await h1(page)) === "今天有什么值得记录？");
      check("C · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }

    // ---------------------------------------------------------------- D · history · K · L · M · P · Q
    {
      const days = [
        { date: "2026-11-03", text: "雨" },
        { date: "2026-11-15", text: "上周日" },
        { date: "2026-11-16", text: "Coffee" },
        { date: "2026-11-17", moments: [{ id: "m-a", title: "一本里的一页" }, { id: "m-b", title: "另一本里的一页", book: "book-b" }] },
        { date: "2026-10-12", text: "十月" },
        // M · written on 11-18 for 10-20 (补记 last month).
        { date: "2026-10-20", text: "补十月", createdAt: "2026-11-18T09:00:00.000Z" },
      ];
      days.books = [{ id: "book-b", title: "旅行本", cover: "", theme: "", bookType: "personal" }];
      const { page, context, errors } = await boot(browser, {
        seed: (list) => {
          const s = JSON.parse(localStorage.getItem("little-days.v1"));
          const book = s.books[0].id;
          s.books.push({ ...s.books[0], id: "book-b", title: "旅行本" });
          const L = (id, text) => ({ id, kind: "text", text, x: 0.5, y: 0.5, scale: 1, rotation: 0 });
          for (const d of list)
            s.entries.push({ id: `e-${d.date}`, date: d.date, title: "", body: "", bookId: book, layers: d.text ? [L(`l-${d.date}`, d.text)] : [], moments: (d.moments || []).map((m) => ({ id: m.id, title: m.title, body: "", layers: [], media: [], bookId: m.book || book, createdAt: `${d.date}T10:00:00.000Z` })), createdAt: d.createdAt || `${d.date}T10:00:00.000Z` });
          localStorage.setItem("little-days.v1", JSON.stringify(s));
        },
        arg: days,
      });
      const before = await read(page);
      let s = await strip(page);
      check("历史数据：升级后不用迁移，按真实手帐日期直接显示（11 月 4 枚）", s.count === "已集 4 枚", s.count);
      check("D 同一天两本手帐：只算 1 枚", s.stamps["2026-11-17"].cls === "word");
      const novDays = new Set(before.entries.filter((e) => e.date.startsWith("2026-11")).map((e) => e.date)).size;
      check("P 本月数量 = 本月有记录的天数", s.count === `已集 ${novDays} 枚`, `${s.count} vs ${novDays}`);
      check("K 首页只显示这个月（10 月的章不在首页）", !Object.keys(s.stamps).some((d) => d.startsWith("2026-10")));
      check("历史：只读不写——打开 App 不写集章记录", !Object.keys(before.recordedDays || {}).length, JSON.stringify(before.recordedDays));
      await touch(page);
      const after = await read(page);
      check("历史：下一次保存时补齐集章记录（6 天）", Object.keys(after.recordedDays || {}).length === 6, JSON.stringify(after.recordedDays));
      const shape = (st) => JSON.stringify(st.entries.map((e) => [e.id, e.date, e.title, e.body, (e.layers || []).map((l) => [l.id, l.text]), (e.moments || []).map((m) => [m.id, m.title, m.bookId])]));
      check("历史：页面、ID、日期、正文都没变", shape(after) === shape(before));
      check("M 11 月补记 10 月：章记在 10 月", Boolean(after.recordedDays["2026-10-20"]) && s.count === "已集 4 枚");
      // Q · this week only (Mon 16 – Sun 22): 16, 17 — not Sunday the 15th.
      const wk = await page.locator(".week-card").innerText();
      check("Q 这一周只算这一周（16、17 日 = 2 个小日子，不算 15 日）", wk.includes("这一周，你留下了 2 个小日子"), wk);
      await page.locator(".week-card").tap();
      await page.waitForSelector(".week-page");
      const days7 = await page.locator(".wp-day").count();
      const kept = await page.locator(".wp-day button").count();
      check("Q 这一周页面：7 天，其中 2 天能打开", days7 === 7 && kept === 2, `${days7} / ${kept}`);
      await page.locator('.wp-day button[data-date="2026-11-16"]').tap();
      await page.waitForFunction(() => location.hash !== "x" && (document.querySelector("#phone.in-reader") || document.querySelector(".day-view, .day-page, .day-detail")));
      check("Q 这一周：点一天能打开那一天", true);
      // K · L · the stamp card page: months.
      await home(page);
      await page.locator(".stamp-strip").tap();
      await page.waitForSelector(".stamps-page");
      check("集章卡：右上一共 6 枚", (await page.locator(".sp-total").innerText()) === "一共 6 枚");
      check("K 集章卡：11 月 30 天，1 日在周日", (await page.locator(".sp-grid .stamp").count()) === 30 && (await page.locator(".sp-grid .stamp-gap").count()) === 6);
      await page.locator('.sp-head [data-action="stamps-month"][data-delta="-1"]').tap();
      check("L 换到 10 月：31 天，已集 2 枚（含 11 月补记的 10 月 20 日）", (await page.locator(".sp-grid .stamp").count()) === 31 && (await page.locator(".sp-count").innerText()) === "已集 2 枚", await page.locator(".sp-count").innerText());
      check("L 10 月之前没有章：不能再往前翻", await page.locator('.sp-head [data-delta="-1"]').isDisabled());
      await page.locator('.sp-grid [data-date="2026-10-12"]').tap();
      check("点一枚章：打开这一天", (await page.locator('.sp-panel [data-action="open-day"][data-date="2026-10-12"]').count()) === 1);
      check("没记的日子不能点（只是空着）", (await page.locator('.sp-grid button[data-date="2026-10-13"]').count()) === 0);
      check("D/K/L/M/P/Q · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }

    // ---------------------------------------------------------------- E · F · G · delete
    {
      const days = [
        { date: "2026-11-05", text: "只有一页" },
        { date: "2026-11-06", text: "第一页", moments: [{ id: "m-6b", title: "第二页" }] },
      ];
      const { page, context, errors } = await boot(browser, {
        seed: (list) => {
          const s = JSON.parse(localStorage.getItem("little-days.v1"));
          const book = s.books[0].id;
          const L = (id, text) => ({ id, kind: "text", text, x: 0.5, y: 0.5, scale: 1, rotation: 0 });
          for (const d of list)
            s.entries.push({ id: `e-${d.date}`, date: d.date, title: "", body: "", bookId: book, layers: d.text ? [L(`l-${d.date}`, d.text)] : [], moments: (d.moments || []).map((m) => ({ id: m.id, title: m.title, body: "", layers: [], media: [], bookId: book, createdAt: `${d.date}T10:00:00.000Z` })), createdAt: `${d.date}T10:00:00.000Z` });
          localStorage.setItem("little-days.v1", JSON.stringify(s));
        },
        arg: days,
      });
      await touch(page); // the ledger is written with the first change
      const del = async (date, moment = "") => {
        await page.evaluate(({ date, moment }) => {
          const b = document.createElement("button");
          b.dataset.action = "read-delete";
          b.dataset.date = date;
          if (moment) b.dataset.moment = moment;
          b.id = "go-delete";
          document.body.append(b);
        }, { date, moment });
        await page.locator("#go-delete").click();
        if (await page.locator("#confirm-dialog[open]").count()) await page.locator("#confirm-ok").click();
        await page.waitForTimeout(500);
        await page.evaluate(() => document.querySelector("#go-delete")?.remove());
      };
      // F · one of two pages deleted: the stamp stays full.
      await del("2026-11-06", "m-6b");
      // E · the only page deleted: an empty (date) stamp stays.
      await del("2026-11-05");
      await home(page);
      const st = await read(page);
      const s = await strip(page);
      const left5 = st.entries.filter((e) => e.date === "2026-11-05").some((e) => (e.layers || []).length || (e.moments || []).length || e.title);
      check("E 删除那天唯一的页面：页面真的删了", !left5);
      check("E 删除后章还在，变成只有日期的空章", s.stamps["2026-11-05"].cls === "empty" && s.stamps["2026-11-05"].text === "5" && Boolean(st.recordedDays["2026-11-05"]), JSON.stringify(s.stamps["2026-11-05"]));
      check("E 空章和从没记过的日子不一样", s.stamps["2026-11-04"].cls.startsWith("none") && s.stamps["2026-11-05"].cls !== s.stamps["2026-11-04"].cls);
      check("F 删了两页中的一页：还是完整的章", s.stamps["2026-11-06"].cls === "word" && s.count === "已集 2 枚", JSON.stringify(s.stamps["2026-11-06"]));
      check("G 空章不显示已删内容的缩略图", !s.stamps["2026-11-05"].img);
      await page.locator(".stamp-strip").tap();
      await page.waitForSelector(".stamps-page");
      await page.locator('.sp-grid [data-date="2026-11-05"]').tap();
      const panel = await page.locator(".sp-panel").innerText();
      check("G 点空章：说明页面已删除、不会自动恢复，没有打开已删页面的按钮", panel.includes("页面已经删掉了") && (await page.locator('.sp-panel [data-action="open-day"]').count()) === 0, panel);
      await page.locator('.sp-panel [data-action="stamp-calendar"]').tap();
      await page.waitForSelector(".calendar-grid, .day-cell");
      const sel = await page.locator(".day-cell.selected").getAttribute("data-date");
      check("G 去日历：停在那一天，显示空的一天（没有报错）", sel === "2026-11-05", sel);
      const st2 = await read(page);
      check("G 看空章不会恢复已删内容", !st2.entries.filter((e) => e.date === "2026-11-05").some((e) => (e.layers || []).length || (e.moments || []).length));
      check("E/F/G · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      // Backup → restore on a fresh install: the stamps come back, the empty one too.
      await home(page);
      await page.locator(".settings-gear").click();
      await page.waitForSelector('[data-action="backup"]');
      const [download] = await Promise.all([page.waitForEvent("download"), SS.backupGo(page)]);
      const file = JSON.parse(require("node:fs").readFileSync(await download.path(), "utf8"));
      const inFile = file.state?.recordedDays || {};
      check("备份：备份文件里有集章记录（含已删页面的 11 月 5 日）", Boolean(inFile["2026-11-05"] && inFile["2026-11-06"]), JSON.stringify(inFile));
      const other = await boot(browser);
      await other.page.locator(".settings-gear").click();
      await other.page.waitForSelector('[data-action="restore-backup"]');
      await other.page.locator("#backup-input").setInputFiles(await download.path());
      await SS.restoreGo(other.page);
      await home(other.page);
      const r = await strip(other.page);
      check("恢复：在另一台（新装）上恢复后，空章和完整的章都回来", r.stamps["2026-11-05"]?.cls === "empty" && r.stamps["2026-11-06"]?.cls === "word" && r.count === "已集 2 枚", JSON.stringify(r.stamps["2026-11-05"]) + r.count);
      const back = await read(other.page);
      check("恢复：删掉的页面没有因为恢复回来", !back.entries.filter((e) => e.date === "2026-11-05").some((e) => (e.layers || []).length || (e.moments || []).length));
      check("备份 / 恢复 · 没有页面错误或系统弹窗", other.errors.length === 0, other.errors.join(" | "));
      await other.context.close();
      await context.close();
    }

    // ---------------------------------------------------------------- H · I · J · a page moves to another date
    // The app has no "move a saved page to another date" button (the date can
    // be changed before saving, in 今天的故事 — then only the date it is saved
    // on gets a stamp). A move changes the page's date in the journal; here the
    // journal is changed the same way and the app re-reads it.
    {
      const days = [
        { date: "2026-11-08", text: "A 的第一页", moments: [{ id: "m-h", title: "要搬走的一页" }] },
        { date: "2026-11-09", text: "只有这一页" },
      ];
      const { page, context, errors } = await boot(browser, {
        seed: (list) => {
          const s = JSON.parse(localStorage.getItem("little-days.v1"));
          const book = s.books[0].id;
          const L = (id, text) => ({ id, kind: "text", text, x: 0.5, y: 0.5, scale: 1, rotation: 0 });
          for (const d of list)
            s.entries.push({ id: `e-${d.date}`, date: d.date, title: "", body: "", bookId: book, layers: d.text ? [L(`l-${d.date}`, d.text)] : [], moments: (d.moments || []).map((m) => ({ id: m.id, title: m.title, body: "", layers: [], media: [], bookId: book, createdAt: `${d.date}T10:00:00.000Z` })), createdAt: `${d.date}T10:00:00.000Z` });
          localStorage.setItem("little-days.v1", JSON.stringify(s));
        },
        arg: days,
      });
      await touch(page);
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("little-days.v1"));
        const a = s.entries.find((e) => e.date === "2026-11-08");
        const m = a.moments.splice(0, 1)[0];
        const book = s.books[0].id;
        s.entries.push({ id: "e-2026-11-12", date: "2026-11-12", title: "", body: "", bookId: book, layers: [], moments: [m], createdAt: "2026-11-18T09:00:00.000Z" });
        const b = s.entries.find((e) => e.date === "2026-11-09");
        b.date = "2026-11-13";
        localStorage.setItem("little-days.v1", JSON.stringify(s));
      });
      await page.reload();
      await page.waitForSelector(".hero .stamp-strip");
      const s = await strip(page);
      check("H 从 A 搬走一页，A 还有别的页：A 仍是完整的章", s.stamps["2026-11-08"].cls === "word");
      check("H/J 搬到的日期 B 盖上完整的章", s.stamps["2026-11-12"].cls === "word" && s.stamps["2026-11-13"].cls === "word");
      check("I A 的唯一一页搬走：A 留下空章", s.stamps["2026-11-09"].cls === "empty");
      check("H/I/J 这个月 4 枚（8、9 空章、12、13）", s.count === "已集 4 枚", s.count);
      check("H/I/J · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }

    // ---------------------------------------------------------------- privacy · English
    {
      const { page, context, errors } = await boot(browser, {
        hide: true,
        seed: () => {
          const s = JSON.parse(localStorage.getItem("little-days.v1"));
          s.entries.push({ id: "e-p", date: "2026-11-16", title: "秘密", body: "", bookId: s.books[0].id, layers: [], moments: [], createdAt: "2026-11-16T10:00:00.000Z" });
          localStorage.setItem("little-days.v1", JSON.stringify(s));
        },
      });
      const s = await strip(page);
      check("隐私：首页不显示今天的内容时，集章条不显示字和照片", s.stamps["2026-11-16"].text === "" && !s.stamps["2026-11-16"].img && s.count === "已集 1 枚", JSON.stringify(s.stamps["2026-11-16"]));
      check("隐私 · 没有页面错误", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    {
      const { page, context, errors } = await boot(browser, {
        lang: "en",
        seed: () => {
          const s = JSON.parse(localStorage.getItem("little-days.v1"));
          s.entries.push({ id: "e-en", date: "2026-11-16", title: "Walk home", body: "", bookId: s.books[0].id, layers: [], moments: [], createdAt: "2026-11-16T10:00:00.000Z" });
          localStorage.setItem("little-days.v1", JSON.stringify(s));
        },
      });
      const s = await strip(page);
      check("English: the stamp card reads 1 stamp", s.count === "1 stamp", s.count);
      const wk = await page.locator(".week-card").innerText();
      check("English: This week, you kept 1 little day", wk.includes("This week, you kept 1 little day"), wk);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      check("English: no sideways scroll at 390", width <= 390, String(width));
      check("English · no page errors", errors.length === 0, errors.join(" | "));
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
