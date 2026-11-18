// V10.80 · 自己写 / 每日一问 / 快速记录 · 翻照片听、补一句 · 每日提醒.
// Synthetic data only; Chromium with a fake microphone (its test tone), an
// emulated phone — not a real iPhone. The iPhone notification bridge is a
// stand-in that records what the page asks for (the real one is Swift,
// LittleDaysReminders.swift; it needs a device or the Simulator).
const { chromium } = require("playwright");
const SS = require("./signed-in.cjs");
SS(chromium);
const path = require("node:path");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const lib = path.join(__dirname, "../Packages/LittleDaysCore/Sources/LittleDaysCore/Resources/Photos");
const photos = (...names) => names.map((n) => path.join(lib, `LD-photo-${n}.jpg`));

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
const read = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.v1") || "null"));
const keyOf = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

async function fresh(browser, { mic = true, lang = "zh-CN", size = { width: 390, height: 844 } } = {}) {
  const context = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true, locale: lang, permissions: mic ? ["microphone"] : [] });
  await context.addInitScript((l) => {
    try {
      if (!sessionStorage.getItem("v184")) {
        sessionStorage.setItem("v184", "1");
        localStorage.setItem("little-days.with-samples", "0");
        localStorage.setItem("little-days.language", l);
        localStorage.setItem("test.keepJot", "1");
        localStorage.setItem("test.keepBookPick", "1");
      }
    } catch {}
    // A stand-in for the iPhone app's notification bridge.
    window.__reminders = [];
    window.webkit = { messageHandlers: { littleDaysReminder: { postMessage: (m) => window.__reminders.push(JSON.parse(JSON.stringify(m))) } } };
  }, lang);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => {
    errors.push(`native dialog: ${d.message()}`);
    d.dismiss();
  });
  await page.goto(base);
  await page.waitForSelector(".hero");
  return { page, context, errors };
}
const lastReminder = (page) => page.evaluate(() => window.__reminders.filter((m) => m.type === "schedule").at(-1) || null);
async function home(page) {
  if (await page.locator("#phone.in-reader").count()) await SS.leaveReader(page);
  if (await page.locator(".jot-page").count()) await page.locator('[data-action="jot-back"]').tap();
  await page.locator('#navigation [data-page="home"]').click();
  await page.waitForSelector(".hero");
}
async function saveJot(page) {
  await page.locator(".jot-save").tap();
  await page.waitForSelector("#phone.in-reader", { timeout: 10000 });
  await page.waitForTimeout(500);
}
async function addPhotos(page, names) {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.locator('[data-action="jot-photo"]').tap()]);
  await chooser.setFiles(photos(...names));
  await page.waitForFunction((n) => document.querySelectorAll(".jot-thumb").length >= n, names.length, { timeout: 10000 });
}
async function recordTake(page, ms = 1300) {
  await page.waitForSelector(".take.recording", { timeout: 8000 });
  await page.waitForTimeout(ms);
  await page.locator('[data-action="take-stop"]').tap();
  await page.waitForSelector(".take.review", { timeout: 8000 });
}
async function openWall(page) {
  await home(page);
  await page.locator('#navigation [data-page="calendar"]').click();
  await page.locator('[data-action="calendar-mode"][data-mode="wall"]').click();
  await page.waitForSelector(".photo-wall .pw-tile");
}
async function openPhoto(page, ref) {
  await page.locator(`.photo-wall .pw-tile[data-ref="${ref}"]`).first().click();
  await page.waitForSelector("#wall-viewer[open] #wv-notes");
  await page.waitForTimeout(500);
}
const notesText = (page) => page.locator("#wv-notes").innerText();

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  try {
    {
      const { page, errors, context } = await fresh(browser);
      const today = keyOf(0);
      // ------------------------------------------------ Today: 自己写 + 每日一问
      check("首页：「自己写」入口", (await page.locator('[data-action="today-write"] b').innerText()) === "自己写");
      const q1 = await page.locator(".daily-prompt .dp-q").innerText();
      check("首页：每日一问显示题目和写一句 / 说一句 / 换一题", q1.length > 4 && (await page.locator(".daily-prompt [data-action=prompt-write]").count()) === 1 && (await page.locator(".daily-prompt [data-action=prompt-say]").count()) === 1 && (await page.locator(".daily-prompt [data-action=prompt-next]").count()) === 1);
      await page.locator('[data-action="prompt-next"]').tap();
      const q2 = await page.locator(".daily-prompt .dp-q").innerText();
      check("换一题：换成另一题", q2 !== q1);
      await page.reload();
      await page.waitForSelector(".hero");
      check("换一题：今天之内记得换过的题", (await page.locator(".daily-prompt .dp-q").innerText()) === q2);

      // ------------------------------------------------ Reminder (before anything is saved)
      await page.locator(".settings-gear").tap();
      await page.waitForSelector(".s2");
      check("提醒：默认关闭", !(await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.reminder") || "{}").on)));
      await page.locator('[data-action="reminder-toggle"]').scrollIntoViewIfNeeded();
      await page.locator('[data-action="reminder-toggle"]').tap();
      await page.waitForSelector("#choose-dialog[open] .reminder-sheet");
      check("提醒：打开时先让人选时间（还没有排通知）", (await page.evaluate(() => window.__reminders.filter((m) => m.type === "schedule" && m.on).length)) === 0);
      check("提醒：说明里写着通知只有这一句话", /今天有什么想留下的？写一句，或说一句就好。/.test(await page.locator(".reminder-sheet .rm-preview").innerText()));
      await page.locator("#reminder-pick").fill("20:30");
      await page.locator('[data-action="reminder-confirm"]').tap();
      await page.waitForTimeout(300);
      let r = await lastReminder(page);
      check("提醒：确认后排上每天 20:30", r?.on === true && r.hour === 20 && r.minute === 30, JSON.stringify(r));
      check("提醒：通知文字是默认中文，没有手帐内容", r?.body === "今天有什么想留下的？写一句，或说一句就好。" && r?.title === "开铺手帐");
      check("提醒：今天还没保存，今天照常提醒", r?.skipToday === false);
      await page.locator("[data-reminder-time]").fill("21:15");
      await page.locator("[data-reminder-time]").dispatchEvent("change");
      await page.waitForTimeout(200);
      r = await lastReminder(page);
      check("提醒：改时间 → 用同一组通知重新排（21:15）", r?.on && r.hour === 21 && r.minute === 15);
      await page.evaluate(() => window.littleDaysReminderResult({ ok: false, reason: "denied" }));
      await page.waitForTimeout(300);
      check("提醒：iPhone 不允许通知 → 开关回到关闭，并说明怎么打开", !(await page.evaluate(() => JSON.parse(localStorage.getItem("little-days.reminder")).on)) && /设置 → 通知/.test(await page.locator(".reminder-warn").innerText()));
      await page.locator('[data-action="reminder-toggle"]').tap();
      await page.waitForSelector("#choose-dialog[open] .reminder-sheet");
      check("提醒：重新开启时记得上次的时间", (await page.locator("#reminder-pick").inputValue()) === "21:15");
      await page.locator('[data-action="reminder-confirm"]').tap();
      await page.waitForTimeout(200);
      check("提醒：重新开启", (await lastReminder(page))?.on === true);
      await home(page);

      // ------------------------------------------------ 1a. 自己写 → a line → preview → saved today
      await page.locator('[data-action="today-write"]').tap();
      await page.waitForSelector('.jot-page[data-from="free"]');
      await page.waitForTimeout(150);
      check("自己写：直接可以输入（光标在输入框）", await page.evaluate(() => document.activeElement?.id === "jot-text"));
      check("自己写：没有内容时不能保存", await page.locator(".jot-save").isDisabled());
      const line = "今天在 café 写下 a mixed line 🙂";
      await page.locator("#jot-text").fill(line);
      await page.waitForTimeout(500);
      check("自己写：自动生成手帐预览（字在页面上）", (await page.locator(".jot-preview .journal-canvas").innerText()).includes("今天在 café"));
      check("自己写：只有一本手帐，放进它（不用再选）", (await page.locator(".jot-where .sb-name").innerText()) === "我的手帐");
      await saveJot(page);
      let s = await read(page);
      let m = s.entries.find((e) => e.date === today)?.moments.at(-1);
      check("自己写：保存到今天，原文一字不改", m?.title === line && !m.prompt, JSON.stringify(m?.title));
      r = await lastReminder(page);
      check("提醒：今天保存了一篇 → 取消今天还没发的提醒（skipToday）", r?.skipToday === true && r.on === true);
      check("保存后在阅读器里打开这一页", (await page.locator(".reader-page .journal-canvas").first().innerText()).includes("a mixed line"));

      // ------------------------------------------------ 1b. backdated
      await home(page);
      await page.locator('[data-action="today-write"]').tap();
      await page.waitForSelector(".jot-page");
      await page.locator("#jot-text").fill("昨天忘了记的");
      await page.locator("[data-jot-date]").fill(keyOf(-1));
      await page.locator("[data-jot-date]").dispatchEvent("change");
      await saveJot(page);
      s = await read(page);
      check("补记昨天：保存到选的那一天", s.entries.find((e) => e.date === keyOf(-1))?.moments.some((x) => x.title === "昨天忘了记的"));

      // ------------------------------------------------ 1c. 每日一问 · 写一句
      await home(page);
      const asked = await page.locator(".daily-prompt").getAttribute("data-prompt");
      await page.locator('[data-action="prompt-write"]').tap();
      await page.waitForSelector(".jot-page .jot-prompt");
      await page.locator("#jot-text").fill("在窗边发呆了十分钟");
      await page.waitForTimeout(450);
      check("每日一问：预览里题目是小字，回答是正文", (await page.locator(".jot-preview .canvas-prompt").innerText()) === q2 && (await page.locator(".jot-preview .journal-canvas").innerText()).includes("在窗边发呆"));
      await saveJot(page);
      s = await read(page);
      m = s.entries.find((e) => e.date === today)?.moments.at(-1);
      check("每日一问：保存到今天，记着回答的是哪一题", m?.title === "在窗边发呆了十分钟" && m.prompt?.id === asked && m.prompt?.text === q2);
      check("每日一问：阅读器里题目是页面顶上的小字", (await page.locator(".reader-page .canvas-prompt").first().innerText()) === q2);

      // ------------------------------------------------ 1d. 说一句: record → listen → again → keep
      await home(page);
      await page.locator('[data-action="prompt-say"]').tap();
      await page.waitForSelector(".jot-page");
      await recordTake(page, 1200);
      check("说一句：录完先能试听（还没写进手帐）", (await page.locator(".take.review audio").count()) === 1 && (await page.locator(".take.review [data-action=take-again]").count()) === 1);
      const firstLen = await page.locator(".take.review .media-duration").innerText();
      await page.locator('.take.review [data-action="take-again"]').tap();
      await recordTake(page, 2300);
      check("重录：换成新的一段", (await page.locator(".take.review .media-duration").innerText()) !== firstLen);
      await page.locator('[data-action="take-keep"]').tap();
      await page.waitForSelector(".take.kept", { timeout: 8000 });
      await page.waitForTimeout(400);
      check("用这段：预览里出现这段声音", (await page.locator(".jot-preview .audio-layer").count()) === 1);
      await saveJot(page);
      s = await read(page);
      m = s.entries.find((e) => e.date === today)?.moments.at(-1);
      check("只录了一段声音也能保存（题目是小字）", m?.media?.length === 1 && m.media[0].kind === "audio" && m.media[0].origin === "recording" && m.prompt && !String(m.title || "").trim());

      // ------------------------------------------------ 2. photo + voice + words → reopen → photo wall → play
      await home(page);
      await page.locator('[data-action="today-write"]').tap();
      await page.waitForSelector(".jot-page");
      await page.locator("#jot-text").fill("海边那天的风");
      await addPhotos(page, ["corner-cafe"]);
      await page.locator('.jot-page [data-action="take-start"]').tap();
      await recordTake(page, 1500);
      await page.locator('[data-action="take-keep"]').tap();
      await page.waitForSelector(".take.kept", { timeout: 8000 });
      await saveJot(page);
      s = await read(page);
      m = s.entries.find((e) => e.date === today)?.moments.at(-1);
      const oneRef = m.layers.find((l) => l.kind === "photo" && !l.gen)?.mediaRef;
      check("照片 + 录音 + 一句话：存在同一页", Boolean(oneRef) && m.media.length === 1 && m.title === "海边那天的风");
      await page.reload();
      await page.waitForSelector(".hero");
      await openWall(page);
      await openPhoto(page, oneRef);
      check("重开 App 后在照片墙打开这张照片：看到原话", (await notesText(page)).includes("海边那天的风"));
      check("……和原来的录音（可以直接点播）", (await page.locator("#wv-notes .wv-voice audio").count()) === 1 && !(await page.locator("#wv-notes .wv-voice .ld-play").isDisabled()));
      await page.locator("#wv-notes .wv-voice .ld-play").tap();
      await page.waitForTimeout(1200);
      check("点播：真的在播放", await page.evaluate(() => { const a = document.querySelector("#wv-notes .wv-voice audio"); return a && !a.paused && a.currentTime > 0; }));
      await page.locator("#wall-viewer .wv-x").tap();

      // ------------------------------------------------ 3. two photos: notes stay with their own photo
      await home(page);
      await page.locator('[data-action="today-write"]').tap();
      await page.waitForSelector(".jot-page");
      await page.locator("#jot-text").fill("两张照片的一页");
      await addPhotos(page, ["cookies", "latte-art"]);
      await saveJot(page);
      s = await read(page);
      const two = s.entries.find((e) => e.date === today).moments.at(-1);
      const [pA, pB] = two.layers.filter((l) => l.kind === "photo" && !l.gen);
      await openWall(page);
      await openPhoto(page, pA.mediaRef);
      check("两张照片的页：整页的话不算在某一张上", !(await notesText(page)).includes("两张照片的一页"));
      await page.locator('[data-action="wallnote-text"]').tap();
      await page.locator("#wv-note-text").fill("A 这张是饼干");
      await page.locator('[data-action="wallnote-save"]').tap();
      await page.waitForTimeout(600);
      check("补一句：马上显示在这张照片下", (await notesText(page)).includes("A 这张是饼干"));
      await page.locator(`#wall-viewer .wv-strip [data-ref="${pB.mediaRef}"]`).tap();
      await page.waitForTimeout(500);
      check("换到另一张：看不到 A 的补记（不串）", !(await notesText(page)).includes("A 这张是饼干"));
      await page.locator('[data-action="wallnote-voice"]').tap();
      await recordTake(page, 1200);
      await page.locator('#wv-notes [data-action="take-keep"]').tap();
      await page.waitForFunction(() => document.querySelectorAll("#wv-notes .wv-voice").length === 1, null, { timeout: 8000 });
      check("补段声音：录完试听后保存，B 这张有了声音", (await page.locator("#wv-notes .wv-voice").count()) === 1);
      await page.locator(`#wall-viewer .wv-strip [data-ref="${pA.mediaRef}"]`).tap();
      await page.waitForTimeout(500);
      check("回到 A：没有 B 的声音", (await page.locator("#wv-notes .wv-voice").count()) === 0 && (await notesText(page)).includes("A 这张是饼干"));
      s = await read(page);
      const after = s.entries.find((e) => e.date === today).moments.find((x) => x.id === two.id);
      const noteA = after.layers.find((l) => l.kind === "text" && l.forPhoto === pA.id);
      const voiceB = after.layers.find((l) => l.kind === "audio" && l.forPhoto === pB.id);
      check("写回原来那一页、原来的日期，各自关联到对的照片", noteA?.text === "A 这张是饼干" && Boolean(voiceB) && after.media.some((c) => c.id === voiceB.clipId) && s.entries.filter((e) => e.date === today).length === 1);
      check("原页的其他内容不变（同一页、同样的照片）", after.id === two.id && after.title === two.title && after.layers.filter((l) => l.kind === "photo" && !l.gen).map((l) => l.id).join() === [pA.id, pB.id].join());
      await page.locator('[data-action="wall-open-page"]').tap();
      await page.waitForSelector("#phone.in-reader");
      await page.waitForTimeout(500);
      check("原手帐页上也看得到补记", (await page.locator(".reader-page .journal-canvas").first().innerText()).includes("A 这张是饼干"));

      // ------------------------------------------------ draft + reminder tap
      await home(page);
      await page.locator('[data-action="today-write"]').tap();
      await page.waitForSelector(".jot-page");
      await page.locator("#jot-text").fill("还没写完的一句");
      await page.waitForTimeout(200);
      await page.locator('[data-action="jot-back"]').tap();
      await page.waitForSelector(".hero");
      check("没保存就返回：草稿留着（提示）", /草稿留着/.test(await page.locator("#toast").innerText()));
      s = await read(page);
      check("草稿不算保存：手帐里没有这句", !s.entries.some((e) => (e.moments || []).some((x) => x.title === "还没写完的一句")));
      await page.reload();
      await page.waitForSelector(".hero");
      await page.evaluate(() => window.littleDaysFromReminder());
      await page.waitForSelector('.jot-page[data-from="reminder"]');
      check("点提醒通知：进入快速记录，草稿还在，可以接着写", (await page.locator("#jot-text").inputValue()) === "还没写完的一句");
      check("提醒进来也可以答每日一问", (await page.locator('[data-action="jot-prompt-on"]').count()) === 1);
      await page.locator('[data-action="jot-prompt-on"]').tap();
      check("……点一下就带上今天的题目", (await page.locator(".jot-page .jot-prompt p").innerText()) === q2);
      await page.locator('[data-action="jot-back"]').tap();

      // ------------------------------------------------ English
      await page.evaluate(() => localStorage.setItem("little-days.language", "en"));
      await page.reload();
      await page.waitForSelector(".hero");
      check("English: Write freely + Daily prompt", (await page.locator('[data-action="today-write"] b').innerText()) === "Write freely" && /Daily prompt/i.test(await page.locator(".daily-prompt .v9-kicker").innerText()) && !/[一-鿿]/.test(await page.locator(".daily-prompt .dp-q").innerText()));
      check("English: buttons", (await page.locator(".daily-prompt").innerText()).includes("Write a line") && (await page.locator(".daily-prompt").innerText()).includes("Say it") && (await page.locator(".daily-prompt").innerText()).includes("Another one"));
      r = await lastReminder(page);
      check("English: the reminder text follows the app language", r?.body === "Anything you’d like to remember from today? Write a line or leave a quick voice note." && r.title === "Capiday");
      s = await read(page);
      check("English: what was written stays exactly as written", s.entries.find((e) => e.date === today).moments.some((x) => x.title === line));
      check("没有页面错误或系统弹窗", errors.length === 0, errors.join(" | "));
      await context.close();
    }

    // ------------------------------------------------ several journals: asked on 保存, nothing chosen for the person
    {
      const { page, errors, context } = await fresh(browser);
      await SS.touchStore(page);
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("little-days.v1"));
        s.books.push({ ...s.books[0], id: "book-b", title: "旅行本" });
        localStorage.setItem("little-days.v1", JSON.stringify(s));
      });
      await page.reload();
      await page.waitForSelector(".hero");
      await page.locator('[data-action="today-write"]').tap();
      await page.waitForSelector(".jot-page");
      check("几本手帐：放进还没替人选", (await page.locator(".jot-where .sb-name").innerText()) === "选一本手帐");
      await page.locator("#jot-text").fill("放进旅行本");
      await page.locator(".jot-save").tap();
      await page.waitForSelector('#choose-dialog[open] .book-pick[data-kind="jot"]');
      check("几本手帐：保存时先问放进哪本", (await page.locator(".bp-book").count()) === 2 && (await page.locator(".bp-book.selected").count()) === 0);
      await page.locator('.bp-book[data-book="book-b"]').tap();
      await page.waitForSelector("#phone.in-reader", { timeout: 10000 });
      const s = await read(page);
      const m = s.entries.find((e) => e.date === keyOf(0))?.moments.find((x) => x.title === "放进旅行本");
      check("几本手帐：存进选的那本", m?.bookId === "book-b");
      check("几本手帐 · 没有页面错误", errors.length === 0, errors.join(" | "));
      await context.close();
    }

    // ------------------------------------------------ microphone not allowed
    {
      const { page, errors, context } = await fresh(browser, { mic: false });
      await page.evaluate(() => {
        // The person said no to the microphone.
        navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
      });
      await page.locator('[data-action="prompt-say"]').tap();
      await page.waitForSelector(".jot-page");
      await page.waitForTimeout(400);
      check("麦克风被拒绝：说明怎么打开，写字照常", (await page.locator(".take-note").count()) === 1 && /麦克风/.test(await page.locator(".take-note").innerText()));
      await page.locator("#jot-text").fill("不录音也能记");
      await saveJot(page);
      const s = await read(page);
      check("麦克风被拒绝：文字照样保存", s.entries.find((e) => e.date === keyOf(0))?.moments.some((x) => x.title === "不录音也能记"));
      check("麦克风被拒绝 · 没有页面错误", errors.length === 0, errors.join(" | "));
      await context.close();
    }
  } catch (error) {
    failures.push(`crashed: ${error.message}`);
    console.log(error);
  } finally {
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
})();
