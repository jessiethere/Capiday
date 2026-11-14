// V10.66 · three iPhone issues (Chromium with the app's own measures — the
// iPhone keyboard and audio hardware are checked on a device, see the
// manual checklist in agent.md). Synthetic data only (fake microphone,
// the app's library photos).
//  P1 · voice: recorded without echo cancellation; the clip is on the page as
//       soon as its file is saved even when the waveform decode is slow (5 s
//       here) — the waveform arrives later without an undo step; the card
//       player shows "starting" (not "playing") until time really moves; the
//       first and second plays are timed into the local log; voice audio is
//       preloaded whole.
//  P2 · 标题: the title sheet sits above a 320 px keyboard (+ candidate bar);
//       saving returns to normal editing.
//  P2 · 写字 · 改字体: the type tools make the sheet compact; the real page's
//       words stay in sight above it while font / size / colour / alignment
//       change; 写字 / dragging the handle up goes back; words, photos kept.
const { chromium, devices } = require("playwright");
require("./signed-in.cjs")(chromium);
const SS = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const photo = (n) => `${__dirname}/../Packages/LittleDaysCore/Sources/LittleDaysCore/Resources/Photos/LD-photo-${n}.jpg`;

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
  });
  const passed = [];
  try {
    // ------------------------------------------------------------------ P1
    {
      const context = await browser.newContext({ ...devices["iPhone 13"], locale: "zh-CN" });
      await context.addInitScript(() => {
        window.__constraints = [];
        const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = (c) => (window.__constraints.push(JSON.stringify(c)), gum(c));
        // A slow waveform decode (like an iPhone decoding a long WebM): 5 s.
        const decode = OfflineAudioContext.prototype.decodeAudioData;
        OfflineAudioContext.prototype.decodeAudioData = function (...a) {
          return new Promise((r) => setTimeout(r, 5000)).then(() => decode.apply(this, a));
        };
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base);
      await page.waitForSelector(".hero");
      const clips = () => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("little-days.v1")); return Object.values(s.drafts || {}).flatMap((d) => [d, ...(d.moments || [])]).flatMap((p) => p.media || []); });
      const events = () => page.evaluate(() => JSON.parse(localStorage.getItem("little-days.events") || "[]").filter((e) => e.e === "media_play"));

      await page.locator('[data-action="quick-open"]').first().tap();
      await page.locator('[data-action="quick-way"][data-way="voice"]').first().tap();
      await page.locator(".quick-start").tap();
      await page.waitForSelector('[data-action="record-audio"]');
      await page.locator('[data-action="record-audio"]').tap();
      await page.waitForSelector('[data-action="stop-recording"]');
      await page.waitForTimeout(1500);
      const stopped = Date.now();
      await page.locator('[data-action="stop-recording"]').tap();
      await page.waitForFunction(() => document.querySelector('#journal-canvas .audio-layer audio[src^="blob:"]'), null, { timeout: 4000 });
      const onPage = Date.now() - stopped;
      assert.ok(onPage < 3000, `on the page ${onPage} ms after 停止 although the waveform takes 5 s`);
      assert.ok((await page.evaluate(() => window.__constraints)).some((c) => /"echoCancellation":false/.test(c)), "recorded without echo cancellation");
      const voice = (await clips()).find((c) => c.origin === "recording");
      assert.ok(voice && !voice.peaks, "saved before its waveform");
      assert.equal(await page.locator('#journal-canvas .audio-layer audio[preload="auto"]').count(), 1, "the voice note is loaded whole ahead of a tap");
      passed.push(`P1 · recorded without echo cancellation; the clip is on the page ${onPage} ms after 停止 while the waveform decode still takes 5 s; preload="auto"`);

      // Played before its waveform is known: the sound keeps playing on the same
      // element when the bars arrive (the page is not re-rendered under it).
      await page.evaluate(() => (document.querySelector("#journal-canvas .audio-layer audio").dataset.mark = "same"));
      await page.locator("#journal-canvas .audio-layer .layer-play").click({ force: true });
      await page.waitForSelector("#journal-canvas .audio-layer.playing", { timeout: 6000 });
      // The waveform arrives later.
      await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem("little-days.v1")); return Object.values(s.drafts || {}).flatMap((d) => [d, ...(d.moments || [])]).flatMap((p) => p.media || []).some((c) => c.origin === "recording" && c.peaks?.length === 20); }, null, { timeout: 12000 });
      const still = await page.evaluate(() => { const a = document.querySelector("#journal-canvas .audio-layer audio"); return { same: a.dataset.mark === "same", paused: a.paused, bars: document.querySelectorAll("#journal-canvas .audio-layer .audio-wave i").length }; });
      assert.ok(still.same && still.bars === 20, `the bars were drawn in place on the same element ${JSON.stringify(still)}`);
      passed.push(`P1 · the waveform (20 bars) is added afterwards, to the same clip, in place — a sound started before it keeps its element (still ${still.paused ? "ended/paused" : "playing"})`);
      await page.evaluate(() => document.querySelector("#journal-canvas .audio-layer audio").pause());

      // The card player: "starting" until time moves, then "playing"; first and again timed.
      await page.evaluate(() => {
        const audio = document.querySelector(".media-card [data-player] audio");
        const real = audio.play.bind(audio);
        audio.play = () => new Promise((resolve, reject) => setTimeout(() => real().then(resolve, reject), 900));
      });
      await page.locator('.media-card [data-action="player-toggle"]').first().tap();
      await page.waitForTimeout(250);
      assert.equal(await page.locator(".media-card .ld-player.starting").count(), 1, "starting shows at once");
      assert.equal(await page.locator(".media-card .ld-player.playing").count(), 0, "not 'playing' before it plays");
      await page.waitForSelector(".media-card .ld-player.playing", { timeout: 6000 });
      assert.equal(await page.locator(".media-card .ld-player.starting").count(), 0);
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("little-days.events") || "[]").some((e) => e.e === "media_play" && e.stage === "moving"));
      await page.locator('.media-card [data-action="player-toggle"]').first().tap(); // pause
      await page.waitForTimeout(200);
      await page.locator('.media-card [data-action="player-toggle"]').first().tap(); // again
      await page.waitForFunction(() => JSON.parse(localStorage.getItem("little-days.events") || "[]").some((e) => e.e === "media_play" && e.stage === "moving" && e.way === "again"), null, { timeout: 6000 });
      const ev = await events();
      const first = ev.find((e) => e.stage === "moving" && e.way === "first");
      const again = ev.find((e) => e.stage === "moving" && e.way === "again");
      assert.ok(first && Number.isFinite(first.ms) && again && Number.isFinite(again.ms), JSON.stringify(ev));
      passed.push(`P1 · card player: 'starting' → 'playing' only when time moves; logged first ${first.ms} ms (900 ms held back here), again ${again.ms} ms`);

      // 媒体检查 shows the timings.
      await page.evaluate(() => document.querySelector("#journal-canvas") && null);
      assert.deepEqual(errors, []);
      await context.close();
    }

    // ------------------------------------------------------------- P2 · 标题
    for (const [label, opts] of [["iPhone 13", devices["iPhone 13"]], ["375×667", { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true }]]) {
      const context = await browser.newContext({ ...opts, locale: "zh-CN" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base);
      await page.waitForSelector(".hero");
      await page.locator('[data-action="today-write"]').first().tap();
      await page.waitForSelector('#journal-canvas [data-inline="title"]');
      await page.evaluate(() => document.activeElement?.blur?.());
      const wav = (() => { const n = 8000, b = Buffer.alloc(44 + n * 2); b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin(i / 6)), 44 + i * 2); return b; })();
      await page.locator("#audio-input").setInputFiles({ name: "wind.wav", mimeType: "audio/wav", buffer: wav });
      await page.waitForSelector("#journal-canvas .audio-layer");
      await page.evaluate(() => document.querySelector('[data-action="tool-close"]')?.click());
      await page.locator("#journal-canvas .audio-layer").first().evaluate((el) => el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
      await page.locator("#journal-canvas .audio-layer .audio-title").first().tap().catch(() => {});
      await page.waitForSelector('.tool-dock.ctx[data-ctx="audio"]');
      const paperBefore = await page.locator("#journal-canvas").boundingBox();
      await page.locator('.tool-dock.ctx [data-action="audio-title"]').tap();
      await page.waitForSelector("#choose-dialog[open] #voice-title");
      // What the app measures on an iPhone when the keyboard (320) + the Chinese candidate bar (44) are up.
      const kb = 364;
      // Let the app's own focus measure run first (in Chromium it finds no
      // keyboard and clears --kb); then stand in for the iPhone's numbers.
      await page.waitForTimeout(500);
      await page.evaluate((kb) => {
        document.documentElement.style.setProperty("--kb", kb + "px");
        document.documentElement.style.setProperty("--vv-h", innerHeight - kb + "px");
      }, kb);
      await page.waitForTimeout(400); // the sheet slides up (0.18 s)
      const where = await page.evaluate((kb) => {
        const f = document.querySelector("#voice-title").getBoundingClientRect();
        const save = document.querySelector('#choose-dialog [data-action="audio-title-save"]').getBoundingClientRect();
        const d = document.querySelector("#choose-dialog").getBoundingClientRect();
        return { focused: document.activeElement?.id, fieldTop: f.top, fieldBottom: f.bottom, saveBottom: save.bottom, sheetTop: d.top, keyboardTop: innerHeight - kb, fontSize: parseFloat(getComputedStyle(document.querySelector("#voice-title")).fontSize) };
      }, kb);
      assert.equal(where.focused, "voice-title");
      assert.ok(where.fieldBottom <= where.keyboardTop && where.fieldTop >= 0 && where.sheetTop >= 0, `${label}: field above the keyboard ${JSON.stringify(where)}`);
      assert.ok(where.fontSize >= 16, "16 px: iOS does not zoom in on focus");
      await page.locator("#voice-title").fill("海边的风");
      await page.keyboard.press("Enter");
      await page.waitForSelector("#choose-dialog:not([open])", { state: "attached" });
      await page.evaluate(() => { document.documentElement.style.removeProperty("--kb"); document.documentElement.style.removeProperty("--vv-h"); });
      await page.waitForFunction(() => document.querySelector("#journal-canvas .audio-layer .audio-title")?.innerText === "海边的风");
      const paperAfter = await page.locator("#journal-canvas").boundingBox();
      assert.ok(Math.abs(paperAfter.width - paperBefore.width) < 2 && Math.abs(paperAfter.y - paperBefore.y) < 2, `${label}: the editor did not jump or zoom ${JSON.stringify([paperBefore, paperAfter])}`);
      assert.equal(await page.locator('.tool-dock.ctx[data-ctx="audio"]').count(), 1, "back to normal editing (the sound still selected)");
      passed.push(`P2 · 标题 (${label}): with a ${kb} px keyboard + candidate bar the field ends at ${Math.round(where.fieldBottom)} ≤ ${where.keyboardTop}; 16 px font; saved; the paper did not move or zoom`);
      assert.deepEqual(errors, []);
      await context.close();
    }

    // ------------------------------------------------- P2 · 写字 · 改字体
    for (const [label, opts] of [["iPhone 13", devices["iPhone 13"]], ["375×667", { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true }]]) {
      const context = await browser.newContext({ ...opts, locale: "zh-CN" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base);
      await page.waitForSelector(".hero");
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.locator('[data-action="today-photos"]').first().tap()]);
      await chooser.setFiles(["frost", "bouquet"].map(photo));
      await page.waitForSelector('[data-action="story-save"]');
      await page.locator('.qe-tools [data-action="story-text"]').tap();
      await page.waitForSelector("#choose-dialog[open] [data-sw-text]");
      await page.locator("#choose-dialog [data-sw-text]").fill("周六的咖啡，风很轻");
      await page.waitForFunction(() => /周六的咖啡/.test(document.querySelector(".story-canvas")?.textContent || ""));
      const draft = () => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("little-days.v1")); const d = Object.values(s.drafts || {}).find((x) => (x.moments || []).some((m) => m.title === "周六的咖啡，风很轻")); const m = d?.moments.find((x) => x.title === "周六的咖啡，风很轻"); return m ? { title: m.title, photos: m.layers.filter((l) => l.kind === "photo").map((l) => [l.mediaRef, Math.round(l.x), Math.round(l.y), Math.round(l.w)]), type: m.typeStyle || {} } : null; });
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.waitForTimeout(1200);
      const before = await draft();
      const fullH = (await page.locator("#choose-dialog .sw").boundingBox()).height;
      assert.equal(await page.locator('#choose-dialog .sw[data-size="full"]').count(), 1, "opens for writing");

      await page.locator('#choose-dialog [data-action="sw-compact"]').tap();
      await page.waitForSelector('#choose-dialog .sw[data-size="compact"] .sw-type', { state: "visible" });
      await page.waitForTimeout(500);
      const words = () => page.evaluate(() => {
        const sheetTop = document.querySelector("#choose-dialog .sw").getBoundingClientRect().top;
        const el = [...document.querySelectorAll(".story-canvas .layer-text")].find((e) => /周六的咖啡/.test(e.textContent));
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el.closest(".layer") || el);
        return { sheetTop, top: r.top, bottom: r.bottom, font: cs.fontFamily, size: parseFloat(cs.fontSize), color: cs.color, align: cs.textAlign, sheetH: document.querySelector("#choose-dialog .sw").getBoundingClientRect().height, vh: innerHeight };
      });
      const w0 = await words();
      assert.ok(w0.sheetH <= w0.vh * 0.47 && w0.sheetH < fullH, `${label}: compact ${Math.round(w0.sheetH)} px of ${w0.vh} (full was ${Math.round(fullH)})`);
      assert.ok(w0.top >= 0 && w0.bottom <= w0.sheetTop, `${label}: the words are in sight above the sheet ${JSON.stringify(w0)}`);
      await page.locator('#choose-dialog [data-action="sw-font"][data-font="song"]').first().tap();
      await page.waitForFunction((f) => { const el = [...document.querySelectorAll(".story-canvas .layer-text")].find((e) => /周六的咖啡/.test(e.textContent)); return el && getComputedStyle(el.closest(".layer") || el).fontFamily !== f; }, w0.font);
      await page.locator('#choose-dialog [data-action="sw-size"][data-dir="1"]').first().tap();
      await page.locator('#choose-dialog [data-action="sw-color"]').nth(3).tap();
      await page.locator('#choose-dialog [data-action="sw-align"][data-align="left"]').first().tap();
      await page.waitForTimeout(500);
      const w1 = await words();
      assert.ok(w1.font !== w0.font && w1.color !== w0.color, "font and colour on the real page");
      assert.ok(w1.top >= 0 && w1.bottom <= w1.sheetTop + 2, `${label}: still in sight after A+ ${JSON.stringify(w1)}`);
      assert.equal(await page.locator('#choose-dialog .sw[data-size="compact"]').count(), 1, "stays compact");
      passed.push(`P2 · 写字 · 改字体 (${label}): compact sheet ${Math.round(w0.sheetH)} px (full ${Math.round(fullH)}); the page's words (${Math.round(w1.top)}–${Math.round(w1.bottom)}) stay above it (${Math.round(w1.sheetTop)}) while font / A+ / colour / left change`);

      // Handle dragged up → writing again, the words kept.
      const grip = await page.locator("#choose-dialog .sw .choose-grabber").boundingBox();
      await page.locator("#choose-dialog .sw .choose-grabber").dispatchEvent("pointerdown", { clientX: grip.x + 10, clientY: grip.y + 2, pointerId: 7, bubbles: true });
      await page.locator("#choose-dialog .sw .choose-grabber").dispatchEvent("pointerup", { clientX: grip.x + 10, clientY: grip.y - 80, pointerId: 7, bubbles: true });
      await page.waitForSelector('#choose-dialog .sw[data-size="full"] [data-sw-text]', { state: "visible" });
      assert.equal(await page.locator("#choose-dialog [data-sw-text]").inputValue(), "周六的咖啡，风很轻");
      await page.locator('#choose-dialog [data-action="sw-compact"]').tap();
      await page.locator('#choose-dialog [data-action="sw-expand"]').tap();
      await page.waitForSelector('#choose-dialog .sw[data-size="full"] [data-sw-text]', { state: "visible" });
      await page.locator('#choose-dialog [data-action="story-text-done"]').tap();
      await page.waitForSelector("#choose-dialog:not([open])", { state: "attached" });
      await page.waitForTimeout(1200);
      const after = await draft();
      assert.equal(after.title, before.title, "the words kept");
      assert.deepEqual(after.photos.map((p) => p[0]).sort(), before.photos.map((p) => p[0]).sort(), "the same photos");
      assert.deepEqual(after.type, { fontId: "song", scale: 1.15, color: after.type.color, align: "left" });
      passed.push(`P2 · 写字 · 改字体 (${label}): handle up / ✎ 写字 → writing again; words and photos kept; type stored on the page`);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(`V10.66 iPhone fixes: ${passed.length} checks passed`);
    passed.forEach((p) => console.log(" ✓ " + p));
  } catch (error) {
    passed.forEach((p) => console.log(" ✓ " + p));
    console.error(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
