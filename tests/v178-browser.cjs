// V10.78 · Backup fixes approved by the Founder (2026-11-15):
//  DS-09 (R3) a backup file larger than restore can read (150 MB) is not
//        handed out or counted as a backup — it says why;
//  DS-12 (R6) saved to 「我的 iPhone › 开铺手帐」 (the app's own folder, deleted
//        with the app): the panel says so instead of "safe if deleted".
// The iPhone shell's answers are given the way the shell gives them
// (window.capidayBackupSaved), as in tests/v163. Synthetic data only.
const { chromium, devices } = require("playwright");
require("./signed-in.cjs")(chromium);
const SS = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";

let passed = 0;
const check = (name, ok, detail = "") => {
  assert.ok(ok, `${name} ${detail}`);
  passed++;
  console.log(`✓ ${name}${detail ? "  " + detail : ""}`);
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
  try {
    const context = await browser.newContext({ ...devices["iPhone 13"], locale: "zh-CN", acceptDownloads: true });
    await context.addInitScript(() => {
      window.capidayFiles = { saveBackup: 1 };
      window.webkit = { messageHandlers: {} };
      // For DS-09 only: make the backup file report a size over the restore limit.
      const size = Object.getOwnPropertyDescriptor(Blob.prototype, "size");
      Object.defineProperty(Blob.prototype, "size", {
        get() {
          return window.__bigBackup && this.type === "application/json" ? 160 * 1024 * 1024 : size.get.call(this);
        },
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector(".hero");
    await SS.touchStore(page);
    const keys = () => page.evaluate(() => ({ at: localStorage.getItem("little-days.last-backup"), how: localStorage.getItem("little-days.last-backup-how") }));
    const openSettings = async () => {
      if (await page.locator("#choose-dialog[open]").count()) await page.evaluate(() => document.querySelector("#choose-dialog").close());
      if (!(await page.locator('[data-action="backup"]').count())) {
        if (!(await page.locator(".settings-gear").count())) await SS.goTab(page, "home");
        await page.locator(".settings-gear").first().click();
      }
      await page.waitForSelector('[data-action="backup"]');
    };

    // DS-09
    await openSettings();
    await page.evaluate(() => (window.__bigBackup = true));
    let downloaded = false;
    page.once("download", () => (downloaded = true));
    await SS.backupGo(page);
    await page.waitForSelector('#choose-dialog[open] [data-bk2="failed"]');
    const failed = await page.locator("#choose-dialog").innerText();
    check("DS-09 · 超过恢复上限的备份不生成，说明原因", /恢复时能读的/.test(failed) && /150/.test(failed), failed.slice(0, 120));
    check("DS-09 · 手帐没变", /一点没变|没有任何改动/.test(failed));
    await page.waitForTimeout(500);
    check("DS-09 · 没有交出文件", !downloaded);
    check("DS-09 · 没有记为备份", (await keys()).at === null);
    await page.evaluate(() => (window.__bigBackup = false));

    // DS-12
    await openSettings();
    const [dl] = await Promise.all([page.waitForEvent("download"), SS.backupGo(page)]);
    await page.waitForSelector('#choose-dialog[open] [data-bk2="waiting"]');
    await page.evaluate(() => window.capidayBackupSaved({ status: "saved", verified: true, place: "app", folder: "", cloud: false, size: 1234 }));
    await page.waitForSelector('#choose-dialog[open] [data-bk2="saved"]');
    const saved = await page.locator("#choose-dialog").innerText();
    check("DS-12 · 写明存到了「我的 iPhone › 开铺手帐」", /我的 iPhone › 开铺手帐/.test(saved), saved.slice(0, 160));
    check("DS-12 · 提醒这个文件夹会随 App 一起删除", /删除开铺手帐时会一起被删除/.test(saved));
    check("DS-12 · 不再说「删除开铺手帐不会删掉它」", !/删除开铺手帐不会删掉它/.test(saved));
    check("DS-12 · 备份照常记下（文件确实存好了）", (await keys()).at !== null);
    void dl;
    check("没有页面错误", !errors.length, errors.join(" | "));
  } finally {
    await browser.close();
  }
  console.log(`\nv178: ${passed} checks passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
