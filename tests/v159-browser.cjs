// V10.63 · 语音播放器的三种外观 + 标题 (design round V10.52 §4, approved).
//  1. A sound added in the editor gets 20 bars from the sound itself (worked
//     out once: quiet start → low bars, loud end → high bars), a title and
//     "0:00 / 0:03"; the look is Minimal.
//  2. Selected: 播放 · 标题 · 外观 · 图层 · 移除. 标题 renames the clip only.
//  3. 外观: three cards; 黑胶 / 录音机 change only layer.skin (file, title,
//     length untouched); a big look stays on the paper; undo brings it back.
//  4. Playing: the bars fill and the time counts; the record turns only while
//     it really plays; with reduced motion it does not turn (the time still runs).
//  5. The reader shows the chosen look; ⏮ ⏭ are hidden from VoiceOver.
// zh 390 (iPhone 13) and en 430 with reduced motion. Synthetic sound.
const { chromium, devices } = require("playwright");
const SS = require("./signed-in.cjs");
SS(chromium);
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";
const shots = process.env.SHOTS || "";

// 3 s: the first half very quiet, the second half loud.
function wav(seconds = 3) {
  const rate = 8000, count = rate * seconds, buffer = Buffer.alloc(44 + count * 2);
  buffer.write("RIFF"); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34); buffer.write("data", 36); buffer.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) buffer.writeInt16LE(Math.sin((i / rate) * Math.PI * 440) * (i < count / 2 ? 600 : 12000), 44 + i * 2);
  return buffer;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
  const passed = [];
  try {
    for (const run of [{ lang: "zh", device: devices["iPhone 13"] }, { lang: "en", device: { viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true }, reduced: true }]) {
      const zh = run.lang === "zh";
      const context = await browser.newContext({ ...run.device, reducedMotion: run.reduced ? "reduce" : "no-preference" });
      await context.addInitScript((lang) => localStorage.setItem("little-days.language", lang), zh ? "zh-CN" : "en");
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("dialog", (d) => errors.push(`native dialog: ${d.message()}`));
      await page.goto(base);
      await page.waitForSelector(".hero");
      const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
      // The page being made (the draft), its sound clip and its layer.
      const now = () =>
        page.evaluate((d) => {
          const s = JSON.parse(localStorage.getItem("little-days.v1"));
          const day = s.drafts[d] || s.entries.find((e) => e.date === d);
          const pages = [day, ...(day.moments || [])];
          const p = pages.find((x) => (x.media || []).some((c) => c.kind === "audio"));
          const clip = p.media.find((c) => c.kind === "audio");
          return { clip, layer: p.layers.find((l) => l.clipId === clip.id) };
        }, today);
      const select = async () => {
        await page.evaluate(() => document.querySelector('[data-action="tool-close"]')?.click());
        await page.locator("#journal-canvas .audio-layer").first().evaluate((el) => el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
        await page.locator("#journal-canvas .audio-layer .audio-title").first().tap().catch(() => {});
        await page.waitForSelector('.tool-dock.ctx[data-ctx="audio"]');
      };
      const onPaper = () =>
        page.evaluate(() => {
          const paper = document.querySelector("#journal-canvas").getBoundingClientRect();
          const box = document.querySelector("#journal-canvas .audio-layer").getBoundingClientRect();
          return box.top >= paper.top - 1 && box.bottom <= paper.bottom + 1;
        });
      const pick = async (skin) => {
        await page.locator('.tool-dock.ctx [data-action="audio-skin"]').tap();
        await page.waitForSelector("#choose-dialog[open] .skin-option");
        await page.locator(`#choose-dialog [data-action="audio-skin-set"][data-skin="${skin}"]`).tap();
        await page.waitForSelector(`#journal-canvas .audio-layer.skin-${skin}`);
        await page.waitForTimeout(300);
      };

      // 1 · A sound on today's page.
      await page.locator('[data-action="today-write"]').first().tap();
      await page.waitForSelector('#journal-canvas [data-inline="title"]');
      await page.keyboard.type(zh ? "海边" : "Seaside");
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.locator("#audio-input").setInputFiles({ name: "wind.wav", mimeType: "audio/wav", buffer: wav(3) });
      await page.waitForSelector("#journal-canvas .audio-layer.skin-minimal");
      await page.waitForFunction(() => document.querySelector("#draft-status")?.dataset.state === "saved", null, { timeout: 15000 });
      const first = await now();
      assert.equal(first.clip.peaks?.length, 20, "20 bars, worked out once");
      const quiet = first.clip.peaks.slice(0, 9), loud = first.clip.peaks.slice(11);
      assert.ok(Math.max(...quiet) < Math.min(...loud), `quiet start, loud end: ${first.clip.peaks}`);
      assert.equal(first.layer.skin, undefined, "Minimal is the default (no field)");
      assert.equal(await page.locator("#journal-canvas .audio-layer .audio-wave i").count(), 20);
      assert.match(await page.locator("#journal-canvas .audio-layer .audio-time").innerText(), /^0:00 \/ 0:0[23]$/);
      passed.push(`${run.lang}: a sound gets 20 bars from the sound (quiet ${quiet[0]} … loud ${loud.at(-1)}), Minimal, 0:00 / 0:03`);

      // 2 · Its tools; 标题.
      await select();
      const dock = await page.$$eval(".tool-dock.ctx button", (els) => els.map((el) => (el.dataset.action === "tool" ? el.dataset.tool : el.dataset.action)));
      assert.deepEqual(dock, ["layer-deselect", "ctx-play", "audio-title", "audio-skin", "layer", "layer-delete"]);
      await page.locator('.tool-dock.ctx [data-action="audio-title"]').tap();
      await page.waitForSelector("#choose-dialog[open] #voice-title");
      await page.locator("#voice-title").fill(zh ? "海边的风" : "Wind by the sea");
      await page.keyboard.press("Enter");
      await page.waitForFunction((v) => document.querySelector("#journal-canvas .audio-layer .audio-title")?.innerText === v, zh ? "海边的风" : "Wind by the sea");
      // The draft is written a moment later (autosave).
      await page.waitForFunction((d) => /海边的风|Wind by the sea/.test(localStorage.getItem("little-days.v1") || ""), today);
      const named = await now();
      assert.equal(named.clip.name, zh ? "海边的风" : "Wind by the sea");
      assert.equal(named.clip.source, first.clip.source, "the same sound file");
      // An empty title keeps the one it had.
      await page.locator('.tool-dock.ctx [data-action="audio-title"]').tap();
      await page.locator("#voice-title").fill("  ");
      await page.locator('#choose-dialog [data-action="audio-title-save"]').tap();
      assert.equal((await now()).clip.name, named.clip.name);
      passed.push(`${run.lang}: selected → 播放 · 标题 · 外观 · 图层 · 移除; 标题 renames only the clip (the file is the same); an empty title keeps the old one`);

      // 3 · 外观.
      await page.locator('.tool-dock.ctx [data-action="audio-skin"]').tap();
      await page.waitForSelector("#choose-dialog[open] .skin-option");
      assert.equal(await page.locator(".skin-option").count(), 3);
      assert.equal(await page.locator('.skin-option.selected[data-skin="minimal"]').count(), 1);
      if (shots) await page.screenshot({ path: `${shots}/v159-looks-${run.lang}.png` });
      await page.locator('#choose-dialog [data-action="choose-close"]').tap();
      await pick("vinyl");
      await page.waitForFunction(() => /"skin":"vinyl"/.test(localStorage.getItem("little-days.v1") || ""));
      let after = await now();
      assert.equal(after.layer.skin, "vinyl");
      assert.deepEqual({ ...after.clip }, { ...named.clip }, "the clip itself (file, title, length, bars) is untouched");
      assert.ok(await onPaper(), "the record stays on the paper");
      if (shots) await page.screenshot({ path: `${shots}/v159-vinyl-${run.lang}.png` });
      await page.locator('[data-action="undo"]').first().tap();
      await page.waitForSelector("#journal-canvas .audio-layer.skin-minimal");
      await select();
      await pick("recorder");
      await page.waitForFunction(() => /"skin":"recorder"/.test(localStorage.getItem("little-days.v1") || ""));
      assert.equal((await now()).layer.skin, "recorder");
      assert.ok(await onPaper(), "the recorder stays on the paper");
      assert.equal(await page.locator("#journal-canvas .audio-layer .rec-keys > i[aria-hidden='true']").count(), 2, "⏮ ⏭ are only drawings");
      const key = await page.locator("#journal-canvas .audio-layer .layer-play").boundingBox();
      assert.ok(key.width >= 36 && key.height >= 36, `play key ${key.width}×${key.height} (+5 px tap edge)`);
      if (shots) await page.screenshot({ path: `${shots}/v159-recorder-${run.lang}.png` });
      passed.push(`${run.lang}: 外观 → three cards; 黑胶 / 录音机 change only layer.skin and stay on the paper; undo brings Minimal back; ⏮ ⏭ hidden`);

      // 4 · Playing: vinyl turns (unless reduced motion), the time runs; Minimal's bars fill.
      await pick("vinyl");
      await page.locator("#journal-canvas .audio-layer .layer-play").click();
      await page.waitForSelector("#journal-canvas .audio-layer.playing", { timeout: 8000 });
      await page.waitForFunction(() => document.querySelector("#journal-canvas .audio-layer .audio-now")?.innerText !== "0:00", null, { timeout: 6000 });
      const spin = await page.evaluate(() => getComputedStyle(document.querySelector("#journal-canvas .vinyl-disc")).animationName);
      assert.equal(spin, run.reduced ? "none" : "ld-turn", "turns only with motion allowed");
      await page.waitForFunction(() => !document.querySelector("#journal-canvas .audio-layer.playing"), null, { timeout: 8000 });
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#journal-canvas .vinyl-disc")).animationName), "none", "stops when it stops");
      await pick("minimal");
      await page.locator("#journal-canvas .audio-layer .layer-play").click();
      await page.waitForFunction(() => document.querySelectorAll("#journal-canvas .audio-wave i.on").length >= 4, null, { timeout: 8000 });
      await page.locator("#journal-canvas .audio-layer .layer-play").click();
      passed.push(`${run.lang}: playing — the time counts, the record ${run.reduced ? "stays still (reduced motion)" : "turns"} and stops at the end; Minimal's bars fill as it plays`);

      // 5 · The reader shows the chosen look.
      await pick("vinyl");
      await page.locator('.sv-top [data-action="save-entry"]').tap();
      await page.waitForSelector(".reader-page .audio-layer.skin-vinyl");
      assert.match(await page.locator(".reader-page .audio-layer .audio-title").innerText(), zh ? /海边的风/ : /Wind by the sea/);
      assert.match(await page.locator(".reader-page .audio-layer .audio-time").innerText(), /0:00 \/ 0:0[23]/);
      passed.push(`${run.lang}: the reader shows 黑胶 with the title and the time`);
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  for (const line of passed) console.log("✓", line);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
