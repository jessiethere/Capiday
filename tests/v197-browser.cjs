// V10.94 · Calendar × Stamp — acceptance A–N in the app.
// Calendar is the one month surface; stamps are its visual layer (and stay on
// Home as the compact card). The clock is fixed at Wednesday 2026-11-18 10:00.
// Synthetic data only (photos are tiny canvas JPEGs). Chromium, not an iPhone.
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

function settings({ lang }) {
  if (localStorage.getItem("v197.boot") === null) {
    localStorage.setItem("v197.boot", "1");
    localStorage.setItem("little-days.with-samples", "0");
    localStorage.setItem("little-days.labs", "0");
    localStorage.setItem("little-days.language", lang);
  }
}
// Pages: own photos on 3 and 18 (today), words on 6 and 12, one October day.
function seed() {
  const s = JSON.parse(localStorage.getItem("little-days.v1"));
  const book = s.books[0].id;
  const jpeg = (hue) => {
    const c = document.createElement("canvas");
    c.width = c.height = 24;
    const g = c.getContext("2d");
    g.fillStyle = `hsl(${hue} 60% 55%)`;
    g.fillRect(0, 0, 24, 24);
    return c.toDataURL("image/jpeg", 0.8);
  };
  const T = (id, text) => ({ id, kind: "text", text, x: 0.5, y: 0.5, scale: 1, rotation: 0 });
  // An own photo as the page's photo (the stamp and photo wall rules read it the same way).
  const page = (date, layers, photo) => ({ id: `e-${date}`, date, title: "", body: "", bookId: book, layers, moments: [], createdAt: `${date}T10:00:00.000Z`, ...(photo ? { photo } : {}) });
  s.entries.push(
    page("2026-11-03", [T("t3", "海边散步")], jpeg(20)),
    page("2026-11-06", [T("t6", "小雨，读完一本书")]),
    page("2026-11-12", [T("t12", "和朋友吃火锅")]),
    page("2026-11-18", [T("t18", "今天的晚霞")], jpeg(200)),
    page("2026-10-20", [T("t20", "十月的一天")]),
  );
  localStorage.setItem("little-days.v1", JSON.stringify(s));
}
async function boot(browser, { lang = "zh-CN", data = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: lang, hasTouch: true });
  await context.addInitScript(settings, { lang: lang === "en" ? "en" : "zh-CN" });
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
  await SS.touchStore(page); // the journal is on disk from the first change
  if (data) {
    await page.evaluate(seed);
    await page.reload();
    await page.waitForSelector(".hero");
  }
  await SS.touchStore(page); // the stamp ledger is written with the first change
  return { page, context, errors };
}
const read = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1")));
const home = async (page) => {
  if (await page.locator("#phone.in-reader").count()) await SS.leaveReader(page);
  if (await page.locator("#choose-dialog[open]").count()) await page.evaluate(() => document.querySelector("#choose-dialog").close());
  await page.locator('#navigation [data-page="home"]').click();
  await page.waitForSelector(".hero .stamp-strip");
};
const toCalendar = async (page) => {
  await home(page);
  await page.locator(".stamp-strip").tap();
  await page.waitForSelector(".cal-card .calendar-grid");
};
const cells = (page) =>
  page.evaluate(() => {
    const out = {};
    for (const b of document.querySelectorAll(".cal-card .cal-day[data-date]")) {
      const st = b.querySelector(".cal-stamp");
      out[b.dataset.date] = {
        face: [...b.classList].find((c) => c.startsWith("st-")),
        stamp: st ? st.className.replace("cal-stamp", "").trim() : "",
        img: Boolean(b.querySelector("img")),
        num: b.querySelector(".cal-num")?.textContent || "",
        today: b.classList.contains("today"),
        label: b.getAttribute("aria-label"),
      };
    }
    return out;
  });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    // ------------------------------------------------------------ A–H · K · N (Chinese)
    {
      const { page, context, errors } = await boot(browser);
      // A · Home keeps the compact stamp card; 看整月 opens the Calendar on this month.
      await home(page);
      const card = await page.evaluate(() => ({ note: document.querySelector(".stamp-strip .ss-note")?.textContent || "", go: document.querySelector(".stamp-strip .ss-go")?.textContent || "", text: document.querySelector(".stamp-strip").textContent }));
      check("A 首页章卡保留：说明是「记下一天，就留下一枚小印记。」，入口叫「看整月」", card.note === "记下一天，就留下一枚小印记。" && card.go.includes("看整月"), JSON.stringify(card));
      check("A 首页没有负向文案（没记 / 错过 / 断签）", !/没记|错过|断|漏|skip/i.test(card.text), card.text);
      await page.locator(".stamp-strip").tap();
      await page.waitForSelector(".cal-card .calendar-grid");
      const where = await page.evaluate(() => ({ nav: document.querySelector('#navigation [aria-current="page"], #navigation .active')?.dataset.page, mode: document.querySelector('.segmented .selected')?.dataset.mode, title: document.querySelector(".cal-card .month-title h2").textContent }));
      check("A 看整月 → 日历（按日子），停在本月 2026年11月", where.mode === "memory" && where.title === "2026年11月", JSON.stringify(where));
      // B · the month line.
      check("B 月份下方：这个月留下了 4 天", (await page.locator(".cal-kept").innerText()) === "这个月留下了 4 天");
      const c = await cells(page);
      // C · photo stamp.
      check("C 有自己照片的日子：照片章（圆形照片 + 日期小签）", c["2026-11-03"].face === "st-photo" && c["2026-11-03"].stamp === "cs-photo" && c["2026-11-03"].img && c["2026-11-03"].num === "3", JSON.stringify(c["2026-11-03"]));
      // D · kept outline stamp.
      check("D 没有照片但有记录：朱砂描边日期章", c["2026-11-06"].face === "st-kept" && c["2026-11-06"].stamp === "cs-kept" && !c["2026-11-06"].img && c["2026-11-12"].face === "st-kept", JSON.stringify([c["2026-11-06"], c["2026-11-12"]]));
      const ring = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.cal-day[data-date="2026-11-06"] .cal-stamp')); return [s.borderTopStyle, s.borderTopColor]; });
      check("D 描边是实线朱砂", ring[0] === "solid" && ring[1] === "rgb(169, 72, 58)", JSON.stringify(ring));
      // E · quiet none.
      const none = c["2026-11-05"];
      check("E 没记的日子：只有安静的日期数字，没有章、没有标记", none.face === "st-none" && !none.stamp && !none.img && none.num === "5", JSON.stringify(none));
      check("E 整个日历没有负向状态（没有「未记」之类的字）", !/未记|没记|错过|missed|skipped/i.test(await page.locator(".cal-card").innerText()));
      // F · today + stamp.
      check("F 今天有照片：照片章 + 今天的样式同时在", c[TODAY].face === "st-photo" && c[TODAY].today && /今天/.test(c[TODAY].label), JSON.stringify(c[TODAY]));
      // G · tap a kept day → that day's existing view.
      await page.locator('.cal-day[data-date="2026-11-06"]').tap();
      await page.waitForFunction(() => document.querySelector("#phone.in-reader") || document.querySelector(".day-view, .day-page, .day-detail"));
      check("G 点有记录的日子：打开那一天（现有的阅读 / 日视图）", /小雨，读完一本书/.test(await page.locator("#app").innerText()));
      // H · tap a quiet day → the ordinary empty state.
      await toCalendar(page);
      await page.locator('.cal-day[data-date="2026-11-05"]').tap();
      await page.waitForTimeout(300);
      const empty = await page.evaluate(() => ({ reader: Boolean(document.querySelector("#phone.in-reader")), sel: document.querySelector(".day-cell.selected")?.dataset.date, open: document.querySelectorAll('.date-summary [data-action="open-day"]').length, write: document.querySelectorAll('.date-summary [data-action="edit-date"]').length }));
      check("H 点没记的日子：停在日历，显示普通的空状态（可以补记）", !empty.reader && empty.sel === "2026-11-05" && empty.open === 0 && empty.write >= 1, JSON.stringify(empty));
      // K · switch months.
      await page.locator('.cal-card [data-action="month"][data-delta="-1"]').tap();
      await page.waitForFunction(() => document.querySelector(".cal-card .month-title h2").textContent === "2026年10月");
      const oct = await cells(page);
      check("K 翻到 10 月：31 天，10 月 20 日是章，计数跟着变", Object.keys(oct).length === 31 && oct["2026-10-20"].face === "st-kept" && (await page.locator(".cal-kept").innerText()) === "这个月留下了 1 天");
      await page.locator('.cal-card [data-action="month"][data-delta="-1"]').tap();
      await page.waitForFunction(() => document.querySelector(".cal-card .month-title h2").textContent === "2026年9月");
      // V10.96: an empty month — Captain sitting by the books (small) and one quiet line.
      const quietMonth = await page.evaluate(() => { const e = document.querySelector(".cal-card .cal-empty"); const img = e?.querySelector('img[data-asset="captain-sit"]'); const grid = document.querySelector(".cal-card .calendar-grid").getBoundingClientRect(); return { text: e?.textContent || "", kept: document.querySelectorAll(".cal-kept").length, img: img ? Math.round(img.getBoundingClientRect().width) : 0, below: e ? e.getBoundingClientRect().top >= grid.bottom - 1 : false }; });
      check("K 没有记录的月份：温和的一句 + 小 Captain（在日期下面，88 宽），没有「0」", quietMonth.text.includes("这个月还安安静静的。") && quietMonth.text.includes("等你想记的时候，我在。") && quietMonth.kept === 0 && quietMonth.img > 0 && quietMonth.img <= 88 && quietMonth.below && (await page.locator(".cal-card .cal-stamp").count()) === 0, JSON.stringify(quietMonth));
      await page.locator('.cal-card [data-action="month"][data-delta="1"]').tap();
      await page.waitForFunction(() => document.querySelector(".cal-card .month-title h2").textContent === "2026年10月");
      check("K 有记录的月份没有空状态 Captain", (await page.locator(".cal-card .cal-empty").count()) === 0);
      // N · the separate stamps month page is retired; old links land on the Calendar.
      await page.evaluate(() => {
        const b = document.createElement("button");
        b.dataset.action = "stamps-open";
        b.id = "old-link";
        document.body.append(b);
      });
      await page.locator("#old-link").click();
      await page.waitForSelector(".cal-card .calendar-grid");
      check("N 旧入口 stamps-open → 日历的本月（不是另一个集章页）", (await page.locator(".stamps-page, .sp-grid").count()) === 0 && (await page.locator(".cal-card .month-title h2").textContent()) === "2026年11月");
      const shell = await page.evaluate(() => [...document.querySelectorAll('[data-action="stamps-month"], [data-action="stamp-pick"]')].length);
      check("N 没有留下集章页的按钮（stamps-month / stamp-pick）", shell === 0);
      check("A–H/K/N · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // ------------------------------------------------------------ I · J · backfill and a date change
    {
      const { page, context, errors } = await boot(browser);
      // I · backfill a quiet day through the Calendar's own 补记.
      await toCalendar(page);
      await page.locator('.cal-day[data-date="2026-11-09"]').tap();
      await page.waitForTimeout(200);
      await page.locator('.date-summary [data-action="edit-date"]').tap();
      await page.waitForSelector("#journal-canvas");
      if (await page.locator('#journal-canvas [data-inline="title"]').count()) {
        await page.locator('#journal-canvas [data-inline="title"]').first().click();
        await page.keyboard.type("补记的一天");
      }
      await page.locator('[data-action="save-entry"]').tap();
      await page.waitForSelector("#phone.in-reader", { timeout: 10000 });
      await toCalendar(page);
      let c = await cells(page);
      check("I 在日历补记 11 月 9 日：那一天马上变成章，计数 +1", c["2026-11-09"].face === "st-kept" && (await page.locator(".cal-kept").innerText()) === "这个月留下了 5 天", JSON.stringify(c["2026-11-09"]));
      // J · a page moves from the 12th to the 14th (the journal is changed the
      // way a move changes it; the app re-reads it): the old date keeps an
      // empty stamp, the new date gets a full one. Same rule as the Home card.
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("little-days.v1"));
        s.entries.find((e) => e.date === "2026-11-12").date = "2026-11-14";
        localStorage.setItem("little-days.v1", JSON.stringify(s));
      });
      await page.reload();
      await page.waitForSelector(".hero");
      await toCalendar(page);
      c = await cells(page);
      check("J 改日期：新日期是完整的章", c["2026-11-14"].face === "st-kept", JSON.stringify(c["2026-11-14"]));
      check("J 改日期：旧日期留下空章（虚线，只有日期），不显示已搬走的内容", c["2026-11-12"].face === "st-empty" && c["2026-11-12"].stamp === "cs-gone" && !c["2026-11-12"].img && c["2026-11-12"].num === "12", JSON.stringify(c["2026-11-12"]));
      await page.locator('.cal-day[data-date="2026-11-12"]').tap();
      await page.waitForTimeout(300);
      check("J 点空章：普通空状态，不打开、不恢复已搬走的页面", (await page.locator("#phone.in-reader").count()) === 0 && (await page.locator('.date-summary [data-action="open-day"]').count()) === 0);
      const st = await read(page);
      check("J 看日历不改数据：14 日的那页还在，12 日没有被恢复", st.entries.some((e) => e.date === "2026-11-14" && e.id === "e-2026-11-12") && !st.entries.some((e) => e.date === "2026-11-12"));
      // The Home card and the Calendar read the same stamps.
      await home(page);
      const homeFaces = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".stamp-strip .stamp[data-date]")].map((s) => [s.dataset.date, s.className])));
      check("J 首页章卡和日历一致：12 日空章、14 日完整", /empty/.test(homeFaces["2026-11-12"]) && /word|photo/.test(homeFaces["2026-11-14"]), JSON.stringify([homeFaces["2026-11-12"], homeFaces["2026-11-14"]]));
      check("I/J · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // ------------------------------------------------------------ L · M · photo wall and search unchanged; English
    {
      const { page, context, errors } = await boot(browser, { lang: "en" });
      await home(page);
      const card = await page.evaluate(() => ({ note: document.querySelector(".stamp-strip .ss-note")?.textContent || "", go: document.querySelector(".stamp-strip .ss-go")?.textContent || "", text: document.querySelector(".stamp-strip").textContent }));
      check("English Home card: “Each day you keep leaves a little mark.” · See the month · no “Days you skip”", card.note === "Each day you keep leaves a little mark." && card.go.includes("See the month") && !/skip/i.test(card.text), JSON.stringify(card));
      await page.locator(".stamp-strip").tap();
      await page.waitForSelector(".cal-card .calendar-grid");
      check("English Calendar: November 2026 · 4 days kept this month · By day", (await page.locator(".cal-card .month-title h2").textContent()) === "November 2026" && (await page.locator(".cal-kept").innerText()) === "4 days kept this month" && (await page.locator('.segmented .selected').innerText()) === "By day");
      const legend = await page.locator(".cal-card .calendar-legend").innerText();
      check("English legend: Photos · Kept (no Chinese)", /Photos/.test(legend) && /Kept/.test(legend) && !/[一-鿿]/.test(legend), legend);
      // L · the photo wall is its own view and keeps working.
      await page.locator('.segmented [data-mode="wall"]').tap();
      await page.waitForSelector(".photo-wall, .pw-tile");
      const wall = await page.evaluate(() => ({ tiles: document.querySelectorAll(".photo-wall .pw-tile").length, grid: document.querySelectorAll(".photo-wall .calendar-grid, .photo-wall .cal-stamp").length }));
      check("L Photo wall unchanged: own photos as tiles, no month grid or stamps in it", wall.tiles >= 2 && wall.grid === 0, JSON.stringify(wall));
      check("L Still three ways in the Calendar at most (By day / Photo wall; no third stamp mode)", (await page.locator(".segmented [data-mode]").count()) <= 3 && (await page.locator('.segmented [data-mode="stamps"]').count()) === 0);
      // M · search is unchanged.
      await page.locator('.segmented [data-mode="memory"]').tap();
      await page.waitForSelector(".cal-card .calendar-grid");
      await page.locator('[data-action="open-search"]').first().tap();
      await page.waitForSelector(".search-page");
      await page.locator("[data-search-input]").fill("火锅");
      await page.waitForSelector(".search-hit");
      check("M Search unchanged: finds the page by its words", /和朋友吃火锅/.test(await page.locator(".search-hit").first().innerText()));
      check("L/M · no page errors or system dialogs", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // ------------------------------------------------------------ a new user: nothing kept yet
    {
      const { page, context, errors } = await boot(browser, { data: false });
      await toCalendar(page);
      const c = await cells(page);
      check("新用户：日历本月一句温和的话，今天没有章也不显示缺席", (await page.locator(".cal-card .cal-empty").innerText()).includes("这个月还安安静静的。") && c[TODAY].face === "st-none" && c[TODAY].today, JSON.stringify(c[TODAY]));
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      check("390 宽：日历 7 列完整，没有横向滚动", width <= 390 && (await page.evaluate(() => { const r = document.querySelector(".cal-card").getBoundingClientRect(); return [...document.querySelectorAll(".cal-card .cal-day")].every((b) => { const x = b.getBoundingClientRect(); return x.left >= r.left - 0.5 && x.right <= r.right + 0.5; }); })), String(width));
      check("新用户 · 没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // ------------------------------------------------------------ Captain turned off / 以后再说: the line alone
    {
      const { page, context, errors } = await boot(browser, { data: false });
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("little-days.v1"));
        s.keeper = { ...(s.keeper || {}), enabled: false, invite: "dismissed" };
        localStorage.setItem("little-days.v1", JSON.stringify(s));
      });
      await page.reload();
      await page.waitForSelector(".hero");
      await toCalendar(page);
      const e = await page.evaluate(() => ({ text: document.querySelector(".cal-card .cal-empty")?.textContent || "", cat: document.querySelectorAll(".cal-card .cal-empty img").length }));
      check("选了「以后再说」/ 关掉 Captain：空月份只有一句话，不出现 Captain", e.text === "这个月还安安静静的。" && e.cat === 0, JSON.stringify(e));
      check("Captain 关闭 · 没有页面错误", errors.length === 0, errors.join(" | "));
      await context.close();
    }
    // ------------------------------------------------------------ 320 wide
    {
      const context = await browser.newContext({ viewport: { width: 320, height: 640 }, locale: "zh-CN", hasTouch: true });
      await context.addInitScript(settings, { lang: "zh-CN" });
      const page = await context.newPage();
      await page.clock.install({ time: new Date(`${TODAY}T10:00:00`) });
      await page.goto(base);
      await page.waitForSelector(".hero");
      await SS.touchStore(page);
      await page.evaluate(seed);
      await page.reload();
      await page.waitForSelector(".hero");
      await SS.touchStore(page);
      await toCalendar(page);
      const fit = await page.evaluate(() => {
        const r = document.querySelector(".cal-card").getBoundingClientRect();
        return { scroll: document.documentElement.scrollWidth, inside: [...document.querySelectorAll(".cal-card .cal-day")].every((b) => { const x = b.getBoundingClientRect(); return x.left >= r.left - 0.5 && x.right <= r.right + 0.5; }), stamp: document.querySelector('.cal-day[data-date="2026-11-03"] .cal-stamp').getBoundingClientRect().width };
      });
      check("320 宽：7 列都在卡片里，章缩小但还在，没有横向滚动", fit.scroll <= 320 && fit.inside && fit.stamp >= 28, JSON.stringify(fit));
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\nv197: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
