// V10.75 · Shelf spine check inside the iOS app (WKWebView, the iPhone's own
// fonts — PingFang has the vertical forms and metrics the spines need; the
// Linux Chromium used for tests/v172 does not lay out vertical Chinese
// correctly). Run by tools/mac/ios-shelf-check.sh through the Debug-only
// `-LittleDaysCheck` launch argument: the shell runs this file's body as an
// async function in the page and prints what it returns.
// Synthetic titles only; on a new simulator (nothing of a person's).
// Creates books through the app's own dialog, then measures every spine on
// the shelf with 1, 3 and 5 books on a row: each character whole and inside
// its spine, the words shown are the start of the title (with "…" only when
// cut), the spine on the shelf. CHECK_PAUSE (ms): time for a screenshot.
const PAUSE = typeof CHECK_PAUSE === "number" ? CHECK_PAUSE : 4000;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
async function until(test, ms = 10000) {
  for (let t = 0; t < ms; t += 100) {
    const v = test();
    if (v) return v;
    await wait(100);
  }
  return null;
}
const tap = async (sel) => {
  const el = await until(() => $(sel));
  if (!el) throw new Error(`not found: ${sel}`);
  el.click();
  await wait(350);
};
const TITLES = [
  ["一个书架放五本！", "minimal-linen"],
  ["？", "magazine-jp"],
  ["测试！？", "magazine-jp"],
  ["我的手帐：第一本", "minimal-linen"],
  ["如果我的名字非常长", "magazine-jp"],
  ["第3本!?", "minimal-linen"],
  ["2026 京都 Kyoto 旅行手帐", "magazine-jp"],
  ["The Very Long Summer Road Trip Journal", "minimal-linen"],
  ["「周末」—— 小日子……", "magazine-jp"],
  ["我们一家三口的周末露营与城市散步小日记", "minimal-linen"],
];
async function books() {
  await tap('#navigation [data-page="books"]');
  if ($('[data-action="all-books"]')) await tap('[data-action="all-books"]');
  if ($('[data-action="put-back"]')) await tap('[data-action="put-back"]');
  await wait(600);
}
async function newBook(title, template) {
  await tap('[data-action="new-book"]');
  await until(() => $("#form-dialog[open]"));
  const input = $('#form-dialog input[name="title"]');
  input.value = title;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await wait(200);
  if (template !== "magazine-jp") {
    await tap('[data-action="cover-browse"]');
    await tap(`#cover-browser-grid [data-template="${template}"]`);
    await tap(".cb-done");
  }
  input.blur();
  await tap('#form-dialog button[type="submit"]');
  await until(() => !$("#form-dialog[open]"), 15000);
  await wait(500);
  await books();
}
function spines() {
  return [...document.querySelectorAll(".bookshelf .spine[data-book]")].map((spine) => {
    const el = spine.querySelector(".spine-title");
    const box = el.getBoundingClientRect();
    const sb = spine.getBoundingClientRect();
    const shown = el.textContent;
    const full = el.dataset.title;
    let cutGlyph = "";
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode()))
      for (let i = 0; i < n.data.length; i++) {
        if (!n.data[i].trim()) continue;
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + 1);
        const q = r.getBoundingClientRect();
        if (!q.width && !q.height) continue;
        if (q.top < box.top - 1 || q.bottom > box.bottom + 1 || q.left < sb.left - 1 || q.right > sb.right + 1) cutGlyph += n.data[i];
      }
    const cut = el.classList.contains("sp-cut");
    const start = cut ? shown.replace(/…$/, "") : shown;
    const shelf = spine.closest(".shelf-books").getBoundingClientRect();
    const ok = full.startsWith(start) && (!cut || shown.endsWith("…")) && (cut || shown === full);
    return {
      full,
      shown,
      cut,
      ok: ok && !cutGlyph && el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1 && sb.right <= document.documentElement.clientWidth + 1 && sb.left >= shelf.left - 1,
      cutGlyph,
      h: Math.round(box.height),
      sh: el.scrollHeight,
      w: Math.round(sb.width),
      font: getComputedStyle(el).fontSize,
    };
  });
}
const report = { width: innerWidth, steps: [] };
await until(() => $("#navigation [data-page]"), 20000);
await wait(2500);
for (const label of ["我自己探索", "跳过"]) [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === label)?.click();
await wait(800);
await books();
const step = async (label) => {
  const list = spines();
  report.steps.push({ label, at: Date.now(), rows: [...document.querySelectorAll(".bookshelf .shelf-books")].map((r) => r.querySelectorAll(".spine[data-book]").length), bad: list.filter((s) => !s.ok), spines: list });
  await wait(PAUSE);
};
await step("start");
for (const [title, tpl] of TITLES.slice(0, 2)) await newBook(title, tpl);
await step("3 on a row");
for (const [title, tpl] of TITLES.slice(2)) await newBook(title, tpl);
await step("5 on a row");
document.querySelector(".app-scroll, #app")?.scrollTo?.(0, 400);
window.scrollTo(0, 400);
await wait(600);
await step("5 on a row · lower rows");
return JSON.stringify({ width: report.width, steps: report.steps.map((s) => ({ label: s.label, at: s.at, rows: s.rows, bad: s.bad, shown: s.spines.map((x) => `${x.full} → ${x.shown} [h${x.h} w${x.w} ${x.font}]`) })) });
