// S1-0 spike (Node): JS container ↔ standard ZIP tools, hostile files, > 4 GiB archives.
// Synthetic data only, written under the folder given as argv[2].
import { writeArchive, openArchive, MIMETYPE, crc32 } from "./capiday-zip.mjs";
import { open, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const dir = process.argv[2] || "/tmp/capiday-js-spike";
await mkdir(dir, { recursive: true });
const report = {};
const fileSource = async (file) => {
  const fh = await open(file);
  const { size } = await fh.stat();
  return { size, fh, read: async (offset, length) => { const b = Buffer.alloc(length); const { bytesRead } = await fh.read(b, 0, length, offset); return new Uint8Array(b.buffer, b.byteOffset, bytesRead); } };
};
const rnd = (n, seed) => { const a = new Uint8Array(n); let x = seed | 1; for (let i = 0; i < n; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; a[i] = x & 255; } return a; };
const sample = () => [
  { name: "mimetype", bytes: new TextEncoder().encode(MIMETYPE) },
  { name: "header.json", bytes: new TextEncoder().encode('{"format":"capiday-backup","formatVersion":"1.0"}') },
  { name: "state.json", bytes: new TextEncoder().encode('{"schemaVersion":1}') },
  ...[0, 1, 2, 3].map((i) => ({ name: `media/m${i}-synthetic.jpg`, bytes: rnd(i === 0 ? 0 : 300_000 * i, i + 7) })),
  { name: "manifest.json", bytes: new TextEncoder().encode('{"media":[]}') },
];

// 1 · JS writer → standard tools (normal + forced ZIP64), and our reader.
for (const [label, forceZip64] of [["normal", false], ["zip64", true]]) {
  const { parts } = writeArchive(sample(), { forceZip64 });
  const file = path.join(dir, `${label}.capiday`);
  await writeFile(file, Buffer.concat(parts.map((p) => Buffer.from(p.buffer, p.byteOffset, p.byteLength))));
  const unzip = execFileSync("unzip", ["-t", file]).toString().trim().split("\n").pop();
  const py = execFileSync("python3", ["-c", "import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip() or 'ok', len(z.namelist()))", file]).toString().trim();
  const src = await fileSource(file);
  const a = await openArchive(src);
  for (const e of a.entries) await a.verify(e);
  await src.fh.close();
  const fh = await open(file);
  const firstBytes = (await fh.read(Buffer.alloc(64), 0, 64, 0)).buffer.subarray(30, 38).toString();
  await fh.close();
  report[`writer-${label}`] = { unzip, python: py, ownReader: `${a.entries.length} entries ok`, mimetypeAt30: firstBytes };
}

// 2 · Python-made archives → our reader (incl. ZIP64 sizes in local + central headers).
const pyMade = path.join(dir, "python.capiday");
execFileSync("python3", ["-c", `
import zipfile,sys
z=zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_STORED)
z.writestr('mimetype','${MIMETYPE}')
with z.open('media/p1-synthetic.mp4','w',force_zip64=True) as f: f.write(bytes(range(256))*4096)
z.writestr('manifest.json','{}')
z.close()`, pyMade]);
{
  const src = await fileSource(pyMade);
  const a = await openArchive(src);
  for (const e of a.entries) await a.verify(e);
  report["reader-python-zip64-entry"] = `${a.entries.length} entries ok`;
  await src.fh.close();
}

// 3 · Hostile files: all must be rejected.
const good = Buffer.concat(writeArchive(sample()).parts.map((p) => Buffer.from(p.buffer, p.byteOffset, p.byteLength)));
const swapName = (buf, from, to) => { const b = Buffer.from(buf); let i; while ((i = b.indexOf(from)) >= 0) b.write(to, i); return b; };
const cases = {
  truncated: good.subarray(0, good.length - 40),
  half: good.subarray(0, good.length >> 1),
  flippedByte: (() => { const b = Buffer.from(good); b[2000] ^= 0xff; return b; })(),
  dotdot: swapName(good, "media/m1-synthetic.jpg", "media/../1-synthetic.jpg"),
  absolute: swapName(good, "media/m1-synthetic.jpg", "/media/1-synthetic.jpgx"),
  backslash: swapName(good, "media/m1-synthetic.jpg", "media\\m1-synthetic.jpg"),
  duplicate: swapName(good, "media/m2-synthetic.jpg", "media/m1-synthetic.jpg"),
  notMimetypeFirst: swapName(good, "mimetype", "state.js"),
};
report.hostile = {};
for (const [label, bytes] of Object.entries(cases)) {
  const file = path.join(dir, `hostile-${label}.capiday`);
  await writeFile(file, bytes);
  const src = await fileSource(file);
  try {
    const a = await openArchive(src);
    for (const e of a.entries) await a.verify(e);
    report.hostile[label] = "ACCEPTED (bad)";
  } catch (e) {
    report.hostile[label] = `rejected: ${e.message}`;
  }
  await src.fh.close();
}

// 4 · > 4 GiB archive written by Python (88 × 50 MiB stored, offsets past 4 GiB): reader + streaming verify of the last entries.
if (process.argv.includes("--big")) {
  const big = path.join(dir, "big.capiday");
  const t0 = Date.now();
  execFileSync("python3", ["-c", `
import zipfile,sys,os
z=zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_STORED,allowZip64=True)
z.writestr('mimetype','${MIMETYPE}')
block=os.urandom(1<<20)
for i in range(88):
    with z.open(f'media/b{i}-synthetic.mp4','w',force_zip64=False) as f:
        for c in range(50): f.write(block)
z.writestr('manifest.json','{}')
z.close()`, big], { maxBuffer: 1 << 20 });
  const t1 = Date.now();
  const src = await fileSource(big);
  const a = await openArchive(src);
  const last = a.entries.filter((e) => e.name.startsWith("media/")).slice(-3);
  const t2 = Date.now();
  let hashed = 0;
  for (const e of last) await a.verify(e, { each: (c) => { hashed += c.length; } });
  const t3 = Date.now();
  report.big = { gib: +(src.size / 2 ** 30).toFixed(2), entries: a.entries.length, lastOffsetGiB: +(last.at(-1).local / 2 ** 30).toFixed(2), pythonWriteS: (t1 - t0) / 1000, openMs: t2 - t1, verifiedLast3MiB: hashed / 2 ** 20, verifyMBps: +((hashed / 2 ** 20) / ((t3 - t2) / 1000)).toFixed(0), rssMB: +(process.memoryUsage().rss / 2 ** 20).toFixed(0) };
  await src.fh.close();
}

// 5 · CRC speed (JS, Node) on 64 MiB.
{ const buf = rnd(64 << 20, 3); const t = Date.now(); crc32(buf); report.crc32MBps = Math.round(64 / ((Date.now() - t) / 1000)); }
console.log(JSON.stringify(report, null, 2));
