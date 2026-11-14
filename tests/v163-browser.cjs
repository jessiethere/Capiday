// V10.67 · 备份我的手帐 / 从备份恢复, step by step (synthetic journal and
// media only, zh at iPhone 13). The iPhone app's Save-to-Files panel is
// native (LittleDaysWebShellView.swift); here its answer is stood in for the
// same way the shell gives it (window.capidayBackupSaved) — the panel itself
// is checked on a device / Simulator.
//  A · the sheet says what goes in (counted from this journal) and what does
//      not; "以后再说" records nothing.
//  B · browser: the file downloads; recorded only when the person says so,
//      and shown as "你确认已存好"; "还没有" records nothing.
//  C · iPhone app: saved + size checked → "系统已确认"; iCloud says the
//      upload is iCloud's; cancelled / no space → nothing recorded, clear words.
//  D · more media than a backup can hold → said before anything is made.
//  E · 从备份恢复: a short word first (it REPLACES — unchanged meaning), then
//      the Files picker, then the S1-1 preview; no room on the device during a
//      restore → "space", the journal byte-identical.
const { chromium, devices } = require("playwright");
require("./signed-in.cjs")(chromium);
const SS = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";

async function seed(page) {
  return page.evaluate(async () => {
    const { MediaStore } = await import("./js/media.mjs");
    const m = new MediaStore();
    const png = async (hue) => {
      const c = document.createElement("canvas");
      c.width = 24;
      c.height = 16;
      const g = c.getContext("2d");
      g.fillStyle = `hsl(${hue} 60% 55%)`;
      g.fillRect(0, 0, 24, 16);
      return new Promise((r) => c.toBlob(r, "image/png"));
    };
    const p1 = await m.put(await png(20), { kind: "photo", name: "synthetic 1" }, null);
    const p2 = await m.put(await png(200), { kind: "photo", name: "synthetic 2" }, null);
    const v = await m.put(new Blob([new Uint8Array(3000).fill(7)], { type: "audio/mp4" }), { kind: "audio", name: "synthetic voice" }, null);
    const vid = await m.put(new Blob([new Uint8Array(5000).fill(9)], { type: "video/mp4" }), { kind: "video", name: "synthetic video" }, null);
    m.close();
    const s = JSON.parse(localStorage.getItem("little-days.v1"));
    const photo = (id, ref) => ({ id, kind: "photo", text: "", mediaRef: "media:" + ref, x: 50, y: 50, w: 40, h: 30, rotation: 0, scale: 1 });
    const day = (date, layers, media = []) => ({ id: "bk-" + date, date, title: "", body: "", photo: "", bookId: s.books[0].id, mood: "", layers: [], media: [], isDemo: false, moments: [{ id: "m-" + date, time: "", title: "合成 " + date, body: "", tags: [], bookId: s.books[0].id, layers, media }] });
    s.entries = s.entries.filter((e) => e.isDemo === true);
    s.entries.push(day("2026-11-01", [photo("l1", p1), photo("l2", p2)]));
    s.entries.push(day("2026-11-02", [], [{ id: "c1", kind: "audio", name: "风", mime: "audio/mp4", source: "media:" + v }, { id: "c2", kind: "video", name: "海", mime: "video/mp4", source: "media:" + vid }]));
    s.drafts = {};
    localStorage.setItem("little-days.v1", JSON.stringify(s));
    return { p1, p2, v, vid };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const passed = [];
  try {
    for (const shell of [false, true]) {
      const label = shell ? "iPhone app" : "browser";
      const context = await browser.newContext({ ...devices["iPhone 13"], locale: "zh-CN", acceptDownloads: true });
      if (shell)
        await context.addInitScript(() => {
          // What the iPhone shell gives the page (LittleDaysWebShellView.swift).
          window.capidayFiles = { saveBackup: 1 };
          window.webkit = { messageHandlers: {} };
        });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("dialog", (d) => errors.push("native dialog: " + d.message()));
      await page.goto(base);
      await page.waitForSelector(".hero");
      await SS.touchStore(page);
      await seed(page);
      await page.reload();
      await page.waitForSelector(".hero");
      const keys = () => page.evaluate(() => ({ at: localStorage.getItem("little-days.last-backup"), how: JSON.parse(localStorage.getItem("little-days.last-backup-how") || "null") }));
      const openSettings = async () => {
        if (await page.locator("#choose-dialog[open]").count()) await page.evaluate(() => document.querySelector("#choose-dialog").close());
        if (!(await page.locator('[data-action="backup"]').count())) {
          if (!(await page.locator(".settings-gear").count())) await SS.goTab(page, "home");
          await page.locator(".settings-gear").first().click();
        }
        await page.waitForSelector('[data-action="backup"]');
      };
      await openSettings();
      assert.match(await page.locator('[data-action="backup"]').innerText(), /备份我的手帐/);

      // A · what goes in, what does not
      await page.locator('[data-action="backup"]').click();
      await page.waitForSelector('#choose-dialog[open] [data-bk2="intro"]');
      await page.waitForFunction(() => /约/.test(document.querySelector("#choose-dialog .bk2-size")?.textContent || ""));
      const intro = await page.locator('#choose-dialog [data-bk2="intro"]').innerText();
      assert.match(intro, /2 天 · 2 页/);
      assert.match(intro, /照片 2 · 视频 1 · 声音 1/);
      assert.match(intro, /文件约 [\d.]+ MB/);
      assert.match(intro, /不会备份：外观和语言、每日提醒、App 锁/);
      assert.match(intro, /快照只留在这台设备上/);
      assert.doesNotMatch(intro, /JSON/i, "no file-format words");
      assert.match(await page.locator('#choose-dialog [data-action="backup-go"]').innerText(), shell ? /选择保存位置/ : /下载备份文件/);
      await page.locator('#choose-dialog [data-action="choose-close"]').click();
      assert.deepEqual(await keys(), { at: null, how: null }, "以后再说 records nothing");
      passed.push(`${label} A · the sheet: 2 天 · 2 页, 照片 2 · 视频 1 · 声音 1, its size, and what is not in it; no "JSON"; 以后再说 records nothing`);

      if (!shell) {
        // B · browser
        let [download] = await Promise.all([page.waitForEvent("download"), SS.backupGo(page)]);
        assert.match(download.suggestedFilename(), /^Capiday-Backup-\d{4}-\d{2}-\d{2}\.json$/);
        const file = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
        assert.equal(file.complete, true);
        assert.equal(file.media.length, 4, "the 2 photos, the sound and the video themselves are in the file");
        await page.waitForSelector('#choose-dialog[open] [data-bk2="downloaded"]');
        assert.match(await page.locator("#choose-dialog").innerText(), /不会告诉 Capiday 它存到了哪里/);
        await page.locator('#choose-dialog [data-bk="no"]').click();
        assert.deepEqual(await keys(), { at: null, how: null }, "还没有 records nothing");
        [download] = await Promise.all([page.waitForEvent("download"), SS.backupGo(page)]);
        await page.locator('#choose-dialog [data-bk="yes"]').click();
        await page.waitForTimeout(300);
        const k = await keys();
        assert.ok(k.at && k.how?.how === "user", JSON.stringify(k));
        await openSettings();
        assert.match(await page.locator(".backup-when").innerText(), /你确认已存好/);
        passed.push("browser B · the file holds all 4 media; 还没有 → nothing recorded; 我已存好 → recorded and shown as 「你确认已存好」 (not as system-verified)");
      } else {
        // C · iPhone app: the system panel's answers
        const answer = async (result) => {
          const [download] = await Promise.all([page.waitForEvent("download"), SS.backupGo(page)]);
          await page.waitForSelector('#choose-dialog[open] [data-bk2="waiting"]');
          assert.match(await page.locator("#choose-dialog").innerText(), /iCloud 云盘/);
          await page.evaluate((r) => window.capidayBackupSaved(r), result);
          return download;
        };
        await answer({ status: "cancelled" });
        await page.waitForFunction(() => /没有保存/.test(document.querySelector("#toast")?.innerText || ""));
        assert.deepEqual(await keys(), { at: null, how: null }, "cancelled → nothing recorded");
        await openSettings();
        await answer({ status: "failed", err: "space" });
        await page.waitForSelector('#choose-dialog[open] [data-bk2="failed"]');
        assert.match(await page.locator("#choose-dialog").innerText(), /空间不够/);
        assert.match(await page.locator("#choose-dialog").innerText(), /没有任何改动/);
        assert.deepEqual(await keys(), { at: null, how: null }, "no space → nothing recorded");
        await openSettings();
        await answer({ status: "saved", verified: false, folder: "Downloads", cloud: false, size: -1 });
        await page.waitForSelector('#choose-dialog[open] [data-bk2="saved"]');
        assert.match(await page.locator("#choose-dialog").innerText(), /无法读回核对/);
        assert.equal((await keys()).how.how, "system");
        await openSettings();
        assert.match(await page.locator(".backup-when").innerText(), /未能核对/);
        const dl = await answer({ status: "saved", verified: true, folder: "开铺手帐备份", cloud: true, size: 12345 });
        assert.ok(dl);
        await page.waitForSelector('#choose-dialog[open] [data-bk2="saved"]');
        const savedText = await page.locator("#choose-dialog").innerText();
        assert.match(savedText, /系统已确认文件完整写入/);
        assert.match(savedText, /上传到云端由 iCloud 完成/);
        assert.equal((await keys()).how.how, "verified");
        await openSettings();
        assert.match(await page.locator(".backup-when").innerText(), /系统已确认存到「开铺手帐备份」/);
        passed.push("iPhone app C · cancelled → 「没有保存」, nothing recorded; no space → clear words, nothing recorded; saved but not checkable → 「未能核对」; saved + size checked → 「系统已确认」, and the iCloud upload is said to be iCloud's");

        // D · too much media for one backup
        await page.evaluate(async () => {
          const { MediaStore } = await import("./js/media.mjs");
          MediaStore.prototype.usage = async () => ({ bytes: 150 * 1024 * 1024, count: 9, missing: 0 });
        });
        await page.locator('[data-action="backup"]').click();
        await page.waitForFunction(() => document.querySelector('#choose-dialog [data-action="backup-go"]')?.disabled === true);
        assert.match(await page.locator("#choose-dialog .bk2-note").innerText(), /100 MB/);
        await page.locator('#choose-dialog [data-action="choose-close"]').click();
        passed.push("iPhone app D · more media than one backup holds: said in the sheet, the button is off (nothing made)");
      }

      // E · 从备份恢复
      await page.reload();
      await page.waitForSelector(".hero");
      await openSettings();
      const backupJSON = await page.evaluate(async () => {
        const { MediaStore } = await import("./js/media.mjs");
        const m = new MediaStore();
        const b = await m.backup(JSON.parse(localStorage.getItem("little-days.v1")));
        m.close();
        return JSON.stringify(b);
      });
      await page.locator('[data-action="restore-backup"]').click();
      await page.waitForSelector('#choose-dialog[open] [data-bk2="restore-intro"]');
      const ri = await page.locator("#choose-dialog").innerText();
      assert.match(ri, /替换/);
      assert.match(ri, /不是合并/);
      assert.match(ri, /7 天内/);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.locator('#choose-dialog [data-action="restore-pick"]').click()]);
      // a file whose photo is new here, while the device has no room
      const changed = JSON.parse(backupJSON);
      changed.media[0].data = changed.media[0].data.replace(/A(?=[^A]*$)/, "B");
      changed.media[0].id = "77777777-2222-4333-8444-555555555555";
      changed.state.entries.find((e) => e.date === "2026-11-01").moments[0].layers[0].mediaRef = "media:" + changed.media[0].id;
      const journalBefore = await page.evaluate(() => localStorage.getItem("little-days.v1"));
      await page.evaluate(() => {
        const add = IDBObjectStore.prototype.add;
        IDBObjectStore.prototype.add = function (...a) {
          if (this.name === "media") throw new DOMException("synthetic full disk", "QuotaExceededError");
          return add.apply(this, a);
        };
      });
      await chooser.setFiles({ name: "Capiday-Backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(changed)) });
      await page.waitForSelector('#choose-dialog[open] [data-action="restore-continue"]');
      assert.match(await page.locator("#choose-dialog").innerText(), /替换现在的手帐/);
      await page.locator('#choose-dialog [data-action="restore-continue"]').click();
      await page.locator("#confirm-dialog[open] #confirm-ok").click();
      await page.waitForSelector('#choose-dialog[open] [data-restore-problem="space"]', { timeout: 20000 });
      assert.match(await page.locator("#choose-dialog").innerText(), /空间不够/);
      assert.equal(await page.evaluate(() => localStorage.getItem("little-days.v1")), journalBefore, "the journal is byte-identical");
      passed.push(`${label} E · 从备份恢复: a short word first (替换, 不是合并, 7 天内可撤销) → 选择备份文件 opens the file picker → the preview; no room on the device → 「空间不够」, the journal unchanged`);

      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(`V10.67 backup & restore UX: ${passed.length} checks passed`);
    passed.forEach((p) => console.log(" ✓ " + p));
  } catch (error) {
    passed.forEach((p) => console.log(" ✓ " + p));
    console.error(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
