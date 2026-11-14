// Upgrade check · step 1 (runs inside the OLD app, Debug, -LittleDaysCheck).
// Writes a SYNTHETIC journal through the app's own stores: 2 books (one with a
// cover photo), 3 days, 5 pages with photos and a sound, a draft, plans,
// habits + check-ins, Captain notes. Generated pixels/bytes only — no real
// photos, nothing sent anywhere. Then reloads so the app opens it as its own.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 150 && !document.querySelector(".hero, #navigation"); i++) await wait(200);
await wait(1500);
const { MediaStore } = await import("./js/media.mjs");
const m = new MediaStore();
const png = async (hue) => {
  const c = document.createElement("canvas");
  c.width = 32; c.height = 24;
  const g = c.getContext("2d");
  g.fillStyle = `hsl(${hue} 60% 55%)`; g.fillRect(0, 0, 32, 24);
  g.fillStyle = "#fff"; g.fillRect(hue % 24, 4, 4, 4);
  return new Promise((r) => c.toBlob(r, "image/png"));
};
const ids = {};
for (const [k, h] of [["p1", 15], ["p2", 95], ["p3", 175], ["cover", 255]]) ids[k] = await m.put(await png(h), { kind: "photo", name: "synthetic " + k }, null);
ids.voice = await m.put(new Blob([new Uint8Array(6000).map((_, i) => (i * 13) & 255)], { type: "audio/mp4" }), { kind: "audio", name: "synthetic voice", duration: 3 }, null);
// A fresh install keeps nothing until the first change: start from the app's
// own starting journal (shared/seed.json, like a new install) when there is none.
let s = JSON.parse(localStorage.getItem("little-days.v1") || "null");
if (!s) {
  const seed = await (await fetch("shared/seed.json")).json();
  s = { ...seed, books: seed.books.slice(0, 1), journals: [], sampleDays: [], entries: [], drafts: {}, habits: [], checks: [] };
  delete s.sampleDays;
}
const photo = (id, ref) => ({ id, kind: "photo", text: "", mediaRef: "media:" + ref, x: 50, y: 50, w: 40, h: 30, rotation: 0, scale: 1 });
const pg = (id, title, body, layers, media = []) => ({ id, time: "09:00", title, body, tags: ["合成"], bookId: "up-book", layers, media });
const day = (date, moments) => ({ id: "up-" + date, date, title: "", body: "", photo: "", bookId: "up-book", mood: "", layers: [], media: [], isDemo: false, moments });
const base = s.books[0];
s.books = [...s.books.filter((b) => b.id !== "up-book"), { ...base, id: "up-book", title: "升级测试本", category: base.category || "daily", coverImage: "media:" + ids.cover }];
s.entries = [
  ...s.entries,
  day("2026-11-10", [pg("u1", "早餐", "合成正文一", [photo("l1", ids.p1), photo("l2", ids.p2)]), pg("u2", "散步", "合成正文二", [photo("l3", ids.p3)])]),
  day("2026-11-11", [pg("u3", "海边", "合成正文三", [], [{ id: "clip-u", kind: "audio", name: "风声", mime: "audio/mp4", source: "media:" + ids.voice }])]),
  day("2026-11-12", [pg("u4", "晚上", "合成正文四", [photo("l4", ids.p1)]), pg("u5", "", "只有字的一页", [])]),
];
s.drafts = { ...(s.drafts || {}), "2026-11-13": { ...day("2026-11-13", [pg("u6", "草稿", "还没写完的草稿", [photo("l5", ids.p2)])]) } };
s.plans = { ...(s.plans || {}), "2026-11-12": [{ id: "up-plan", text: "买手帐纸", done: false }] };
s.habits = [...(s.habits || []).filter((h) => h.id !== "up-habit"), { id: "up-habit", title: "喝水", theme: "sage", kind: "completion", target: 7, minutes: 0 }];
s.checks = [...(s.checks || []), { habitId: "up-habit", date: "2026-11-11", minutes: 0, note: "合成打卡" }];
s.keeper = { ...(s.keeper || {}), name: "升级队长", notes: ["合成记忆"] };
const raw = JSON.stringify(s);
localStorage.setItem("little-days.v1", raw);
await new Promise((res, rej) => { const q = indexedDB.open("little-days-meta"); q.onsuccess = () => { const tx = q.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(raw, "little-days.v1"); tx.oncomplete = () => { q.result.close(); res(); }; tx.onerror = () => rej(tx.error); }; q.onerror = () => rej(q.error); });
setTimeout(() => location.reload(), 300);
return JSON.stringify({ seeded: true, media: Object.keys(ids).length });
