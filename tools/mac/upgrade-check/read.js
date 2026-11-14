// Upgrade check · read the synthetic journal back (old or new app, -LittleDaysCheck).
// Waits for the app to be on screen, then reports what the journal holds
// (counted the same way in both versions) and whether every media file is readable.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 100 && !document.querySelector(".hero, #navigation"); i++) await wait(200);
await wait(2500);
const raw = await new Promise((res) => { const q = indexedDB.open("little-days-meta"); q.onsuccess = () => { const g = q.result.transaction("kv").objectStore("kv").get("little-days.v1"); g.onsuccess = () => { res(g.result); q.result.close(); }; g.onerror = () => res(null); }; q.onerror = () => res(null); });
const s = JSON.parse(raw || "null");
if (!s) return JSON.stringify({ error: "no journal in IndexedDB" });
const refs = new Set();
JSON.stringify(s).replace(/media:([A-Za-z0-9-]{8,64})/g, (_, id) => refs.add(id));
const readable = await new Promise((res) => { const q = indexedDB.open("little-days-media"); q.onsuccess = () => { const st = q.result.transaction("media").objectStore("media"); let ok = 0, pending = refs.size; if (!pending) res(0); for (const id of refs) { const g = st.get(id); g.onsuccess = () => { const r = g.result; const n = r?.bytes?.byteLength ?? r?.blob?.size ?? 0; if (n > 0) ok++; if (--pending === 0) res(ok); }; } }; q.onerror = () => res(-1); });
const own = s.entries.filter((e) => e.isDemo !== true);
const up = own.filter((e) => e.id.startsWith("up-"));
const pages = up.reduce((n, e) => n + (e.moments || []).length, 0);
const kvKeys = await new Promise((res) => { const q = indexedDB.open("little-days-meta"); q.onsuccess = () => { const g = q.result.transaction("kv").objectStore("kv").getAllKeys(); g.onsuccess = () => { res(g.result); q.result.close(); }; }; q.onerror = () => res([]); });
const text = [...document.querySelectorAll("#app")].map((e) => e.innerText).join(" ");
return JSON.stringify({
  books: s.books.map((b) => b.title).sort(),
  coverRef: s.books.find((b) => b.id === "up-book")?.coverImage || "",
  days: up.map((e) => e.date).sort(),
  pages,
  bodies: up.flatMap((e) => e.moments.map((m) => m.body)).sort(),
  draft: s.drafts?.["2026-11-13"]?.moments?.[0]?.body || "",
  plan: s.plans?.["2026-11-12"]?.[0]?.text || "",
  habit: (s.habits || []).some((h) => h.id === "up-habit"),
  check: (s.checks || []).find((c) => c.habitId === "up-habit")?.note || "",
  keeper: s.keeper?.name || "",
  mediaRefs: refs.size,
  mediaReadable: readable,
  schemaVersion: s.schemaVersion,
  snapshotKeys: kvKeys.filter((k) => String(k).includes(".snap.")).length,
  restoreRecord: localStorage.getItem("little-days.restore-journal"),
  rescueShown: Boolean(document.querySelector(".rescue-panel")),
  appTitleHasLittleDays: /Little Days/.test(document.title + " " + text),
  title: document.title,
});
