// V10.78 · DS-02 / DS-04…DS-08 · `.capiday` and automatic iCloud backup, with
// the iPhone shell played by this test the way LittleDaysICloudBackup.swift
// answers (`capidayICloud` messages, `capidayAutoBackupDone`, files read back
// through a URL). Synthetic data only: two days, two generated pictures.
// Checks: the iCloud row only in the app; 现在备份 makes a `.capiday` that is
// the journal exactly (read back in Node); saved → "已检查，等待上传" then
// "已上传"; iCloud off/unavailable → said plainly, no file; 从 iCloud 恢复 →
// the usual preview, confirm, and the journal comes back with its pictures.
const { chromium } = require("playwright");
require("./signed-in.cjs")(chromium);
const SS = require("./signed-in.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.PREVIEW_URL || "http://127.0.0.1:8080";

let passed = 0;
const check = (name, ok, detail = "") => {
  assert.ok(ok, `${name} ${detail}`);
  passed++;
  console.log(`✓ ${name}${detail ? "  " + detail : ""}`);
};

(async () => {
  const C = await import("../Public/js/capiday-format.mjs");
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
  try {
    // The browser (no shell): no iCloud row.
    {
      const page = await browser.newPage({ viewport: { width: 393, height: 852 }, locale: "zh-CN" });
      await page.goto(base);
      await page.waitForSelector(".hero");
      await page.locator(".settings-gear").first().click();
      await page.waitForSelector('[data-action="backup"]');
      check("浏览器里没有 iCloud 设置（只在 iPhone App 里）", (await page.locator('[data-action="icloud-now"]').count()) === 0);
      await page.close();
    }

    const context = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: "zh-CN", acceptDownloads: true, hasTouch: true });
    await context.addInitScript(() => {
      // The shell, played here: a container with the backups it holds.
      window.capidayFiles = { saveBackup: 1, icloud: 1 };
      // Kept across reloads (like a real container): the files as base64.
      window.__icloud = JSON.parse(sessionStorage.getItem("fake-icloud") || "null") || { available: true, files: [], uploaded: false };
      window.__icloudSave = () => sessionStorage.setItem("fake-icloud", JSON.stringify(window.__icloud));
      window.webkit = {
        messageHandlers: {
          capidayICloud: {
            postMessage(m) {
              setTimeout(() => {
                const w = window.__icloud;
                if (m.cmd === "status") window.capidayICloudReply({ id: m.id, cmd: "status", ok: true, available: w.available, backups: w.available ? w.files.map(({ b64, ...f }) => ({ ...f, uploaded: w.uploaded })) : [] });
                if (m.cmd === "prepare") {
                  const f = w.files.find((x) => x.name === m.name);
                  const url = f ? URL.createObjectURL(new Blob([Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0))], { type: "application/vnd.capiday.backup+zip" })) : "";
                  window.capidayICloudReply({ id: m.id, cmd: "prepare", ok: Boolean(url), url, err: f ? "" : "download" });
                }
              }, 20);
            },
          },
        },
      };
      try {
        if (!sessionStorage.getItem("v182")) {
          sessionStorage.setItem("v182", "1");
          localStorage.setItem("little-days.with-samples", "0");
        }
      } catch {}
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector(".hero");
    await SS.touchStore(page);
    // Two synthetic pictures written straight into the app's media store (as tests/v161 does).
    await page.evaluate(async () => {
      const pic = (color) => new Promise((r) => { const c = document.createElement("canvas"); c.width = 40; c.height = 50; const x = c.getContext("2d"); x.fillStyle = color; x.fillRect(0, 0, 40, 50); c.toBlob(async (b) => r(await b.arrayBuffer()), "image/png"); });
      const ids = ["00000000-0000-4000-8000-0000000000a1", "00000000-0000-4000-8000-0000000000a2"];
      const bytes = [await pic("#c96"), await pic("#69c")];
      await new Promise((res, rej) => {
        const q = indexedDB.open("little-days-media");
        q.onsuccess = () => {
          const tx = q.result.transaction("media", "readwrite");
          ids.forEach((id, i) => tx.objectStore("media").put({ id, bytes: bytes[i], mime: "image/png", size: bytes[i].byteLength, kind: "photo", name: `p${i}.png`, createdAt: new Date().toISOString() }));
          tx.oncomplete = () => { q.result.close(); res(); };
          tx.onerror = () => rej(tx.error);
        };
        q.onerror = () => rej(q.error);
      });
      const ph = (id, ref) => ({ id, kind: "photo", text: "", mediaRef: ref, x: 50, y: 40, scale: 1, rotation: 0 });
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      s.entries.push({ id: "i1", date: "2026-11-01", bookId: s.books[0].id, title: "", body: "", photo: "", mood: "", layers: [], media: [], isDemo: false, moments: [{ id: "im1", time: "09:00", title: "备份里的一页", body: "", bookId: s.books[0].id, tags: [], media: [], layers: [ph("a", "media:" + ids[0]), ph("b", "media:" + ids[1])] }] });
      localStorage.setItem("little-days.v1", JSON.stringify(s));
    });
    await page.reload();
    await page.waitForSelector(".hero");
    await page.waitForTimeout(800);
    let original = await page.evaluate(() => localStorage.getItem("little-days.v1"));
    const openSettings = async () => {
      if (await page.locator("#choose-dialog[open]").count()) await page.evaluate(() => document.querySelector("#choose-dialog").close());
      if (!(await page.locator('[data-action="icloud-now"]').count())) {
        await SS.goTab(page, "home");
        await page.locator(".settings-gear").first().click();
      }
      await page.waitForSelector('[data-action="icloud-now"]');
    };
    await openSettings();
    check("App 里：设置里有「自动备份到 iCloud」，默认打开", (await page.locator('[data-action="icloud-toggle"]').getAttribute("aria-checked")) === "true");
    check("还没有备份时如实写「还没有 iCloud 备份」", /还没有 iCloud 备份/.test(await page.locator(".icloud-status").innerText()));

    // 现在备份到 iCloud
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.locator('[data-action="icloud-now"]').click()]);
    const name = dl.suggestedFilename();
    check("交给外壳的是 Capiday-Auto-…capiday", /^Capiday-Auto-\d{4}-\d{2}-\d{2}-\d{4}\.capiday$/.test(name), name);
    const bytes = fs.readFileSync(await dl.path());
    const back = await C.readCapiday(new Blob([bytes]));
    check("文件三层检查都通过（Node 里读回）", back.complete === true);
    // The journal as the app holds it at backup time (its first save fills in defaults of this hand-written test state).
    original = await page.evaluate(() => localStorage.getItem("little-days.v1"));
    const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
    // The app backs up the journal it holds (normalized: defaults filled in) — compare with that.
    const held = await page.evaluate(async () => { const m = await import("./js/model.mjs"); return JSON.stringify(m.normalizeState(JSON.parse(localStorage.getItem("little-days.v1")))); });
    const same = JSON.stringify(sortKeys(back.state)) === JSON.stringify(sortKeys(JSON.parse(held)));
    if (!same) { const a = sortKeys(back.state), b = sortKeys(JSON.parse(original)); for (const k of Object.keys({ ...a, ...b })) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) console.log("DIFF key", k, JSON.stringify(a[k])?.slice(0, 150), "|", JSON.stringify(b[k])?.slice(0, 150)); }
    check("文件里的手帐和 App 里的完全一样", same);
    check("两张图片原样在里面（不是 base64）", back.media.length >= 2 && bytes.length < 200000, `${back.media.length} files, ${bytes.length} bytes`);
    // The shell saved it into iCloud (not uploaded yet).
    await page.evaluate(({ name, size, b64 }) => {
      window.__icloud.files.push({ name, size, date: new Date().toISOString(), downloaded: true, b64 });
      window.__icloudSave();
      window.capidayAutoBackupDone({ status: "saved", name, size });
    }, { name, size: bytes.length, b64: bytes.toString("base64") });
    await page.waitForFunction(() => /等待上传/.test(document.querySelector(".icloud-status")?.textContent || ""), null, { timeout: 10000 });
    check("存好后：「已检查，等待上传到 iCloud」（不说成已上传）", true);
    check("算作一次备份（备份提醒不再催）", (await page.evaluate(() => localStorage.getItem("little-days.last-backup"))) !== null);
    await page.evaluate(() => { window.__icloud.uploaded = true; window.__icloudSave(); });
    await SS.goTab(page, "home");
    await openSettings();
    await page.waitForFunction(() => /已上传到 iCloud/.test(document.querySelector(".icloud-status")?.textContent || ""), null, { timeout: 10000 });
    check("上传完以后：「已上传到 iCloud」", true);
    check("备份不改手帐", (await page.evaluate(() => localStorage.getItem("little-days.v1"))) === original);

    // Change the journal, then restore from iCloud: preview, confirm, back as it was.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      s.entries = s.entries.filter((e) => e.id !== "i1");
      localStorage.setItem("little-days.v1", JSON.stringify(s));
    });
    await page.reload();
    await page.waitForSelector(".hero");
    await openSettings();
    await page.locator('[data-action="icloud-restore"]').click();
    await page.waitForSelector("#choose-dialog[open] .icloud-restore-sheet");
    check("从 iCloud 恢复：列出备份（已上传）", (await page.locator('#choose-dialog [data-action="icloud-pick"]').count()) === 1 && /已上传/.test(await page.locator('#choose-dialog [data-action="icloud-pick"]').innerText()));
    await page.locator('#choose-dialog [data-action="icloud-pick"]').click();
    await page.waitForSelector('#choose-dialog[open] [data-action="restore-continue"]', { timeout: 20000 });
    check("先显示备份与现在的对比（和手动恢复一样）", (await page.locator("#choose-dialog .rs-compare").count()) === 1);
    await page.locator('#choose-dialog [data-action="restore-continue"]').click();
    await page.locator("#confirm-dialog[open] #confirm-ok").click();
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem("little-days.v1")).entries || []).some((e) => e.id === "i1"), null, { timeout: 30000 });
    await page.waitForTimeout(800);
    const restored = await page.evaluate(async () => {
      const s = JSON.parse(localStorage.getItem("little-days.v1"));
      const m = s.entries.find((e) => e.id === "i1").moments[0];
      return { title: m.title, refs: m.layers.map((l) => l.mediaRef) };
    });
    check("恢复后：那一页回来了", restored.title === "备份里的一页");
    const readable = await page.evaluate(async (refs) => {
      const ids = refs.map((r) => r.slice(6));
      return new Promise((res) => {
        const q = indexedDB.open("little-days-media");
        q.onsuccess = () => {
          const out = [];
          const tx = q.result.transaction("media");
          ids.forEach((id) => { const g = tx.objectStore("media").get(id); g.onsuccess = () => out.push(Boolean(g.result && (g.result.bytes?.byteLength || g.result.blob?.size))); });
          tx.oncomplete = () => { q.result.close(); res(out); };
        };
      });
    }, restored.refs);
    check("恢复后：两张图片都在媒体库里，可以读取", readable.length === 2 && readable.every(Boolean), JSON.stringify(readable));

    // iCloud not available: said plainly, no file made.
    await page.evaluate(() => { window.__icloud.available = false; window.__icloudSave(); });
    await openSettings();
    let downloaded = false;
    page.once("download", () => (downloaded = true));
    await page.locator('[data-action="icloud-now"]').click();
    await page.waitForFunction(() => /iCloud 现在用不了/.test(document.querySelector("#toast")?.textContent || ""), null, { timeout: 10000 });
    await page.waitForTimeout(500);
    check("iCloud 用不了：如实提示（登录 / 打开 iCloud 云盘），不生成文件", !downloaded);
    // Switch off.
    await page.locator('[data-action="icloud-toggle"]').click();
    check("可以关掉自动备份", (await page.evaluate(() => localStorage.getItem("little-days.icloud-auto"))) === "0");
    check("没有页面错误", !errors.length, errors.join(" | "));
  } finally {
    await browser.close();
  }
  console.log(`\nv182: ${passed} checks passed`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
