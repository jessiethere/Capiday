// S1-0 spike · `.capiday` container in JavaScript (docs/CAPIDAY_BACKUP_FORMAT.md).
// Same rules as spikes/s1-0/CapidayZip.swift, for the browser path (the online
// link) and as a second implementation to cross-check the format.
//
// Reader: random access through `source.read(offset, length)` — a File/Blob
// (slice) in the browser or a file handle in Node — so a multi-GB file is never
// read whole. Writer: for in-memory entries (the browser path is small by
// design): CRC is computed before each header, so no patching is needed.

const SIG = { local: 0x04034b50, central: 0x02014b50, end: 0x06054b50, end64: 0x06064b50, loc64: 0x07064b50 };
export const MIMETYPE = "application/vnd.capiday.backup+zip";

// ---------- CRC-32 (slicing-by-4) ----------
const T = (() => {
  const t = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[0][i] = c >>> 0;
  }
  for (let i = 0; i < 256; i++) for (let k = 1; k < 4; k++) t[k][i] = (t[k - 1][i] >>> 8) ^ t[0][t[k - 1][i] & 0xff];
  return t;
})();
export function crc32(bytes, crc = 0) {
  let c = ~crc >>> 0;
  let i = 0;
  const n = bytes.length;
  for (; i + 4 <= n; i += 4) {
    c ^= bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24);
    c = T[3][c & 0xff] ^ T[2][(c >>> 8) & 0xff] ^ T[1][(c >>> 16) & 0xff] ^ T[0][c >>> 24];
  }
  for (; i < n; i++) c = T[0][(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

// ---------- paths (format spec §3) ----------
const FIXED = new Set(["mimetype", "header.json", "state.json", "manifest.json", "manifest.sig.json"]);
export function checkPath(name) {
  if (FIXED.has(name)) return true;
  return /^media\/[A-Za-z0-9-]{1,64}\.[a-z0-9]{1,8}$/.test(name);
}

const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
const u64 = (v) => { const lo = v % 2 ** 32, hi = Math.floor(v / 2 ** 32); return [...u32(lo), ...u32(hi)]; };

/** Writer: `entries` = [{ name, bytes: Uint8Array }]. Returns the parts (for new Blob(parts)) and per-entry CRC. */
export function writeArchive(entries, { forceZip64 = false } = {}) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  const seen = new Set();
  let offset = 0;
  if (entries[0]?.name !== "mimetype") throw new Error("mimetype must come first");
  for (const { name, bytes } of entries) {
    if (!checkPath(name)) throw new Error(`unsafe path ${name}`);
    if (seen.has(name)) throw new Error(`duplicate ${name}`);
    seen.add(name);
    if (bytes.length >= 0xffffffff) throw new Error("entry ≥ 4 GiB");
    const nameBytes = enc.encode(name);
    const crc = crc32(bytes);
    const header = new Uint8Array([...u32(SIG.local), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(bytes.length), ...u32(bytes.length), ...u16(nameBytes.length), ...u16(0)]);
    central.push({ nameBytes, crc, size: bytes.length, offset });
    parts.push(header, nameBytes, bytes);
    offset += header.length + nameBytes.length + bytes.length;
  }
  const cdStart = offset;
  for (const e of central) {
    const big = forceZip64 || e.offset >= 0xffffffff;
    const extra = big ? [...u16(1), ...u16(8), ...u64(e.offset)] : [];
    const r = new Uint8Array([...u32(SIG.central), ...u16(0x031e), ...u16(big ? 45 : 20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(e.crc), ...u32(e.size), ...u32(e.size), ...u16(e.nameBytes.length), ...u16(extra.length), ...u16(0), ...u16(0), ...u16(0), ...u32(0o100644 * 65536), ...u32(big ? 0xffffffff : e.offset)]);
    parts.push(r, e.nameBytes, new Uint8Array(extra));
    offset += r.length + e.nameBytes.length + extra.length;
  }
  const cdSize = offset - cdStart;
  const need64 = forceZip64 || central.length >= 0xffff || cdStart >= 0xffffffff;
  if (need64) {
    parts.push(new Uint8Array([...u32(SIG.end64), ...u64(44), ...u16(0x031e), ...u16(45), ...u32(0), ...u32(0), ...u64(central.length), ...u64(central.length), ...u64(cdSize), ...u64(cdStart), ...u32(SIG.loc64), ...u32(0), ...u64(offset), ...u32(1)]));
  }
  const n = need64 ? 0xffff : central.length;
  parts.push(new Uint8Array([...u32(SIG.end), ...u16(0), ...u16(0), ...u16(n), ...u16(n), ...u32(need64 ? 0xffffffff : cdSize), ...u32(need64 ? 0xffffffff : cdStart), ...u16(0)]));
  return { parts, entries: central.map((e, i) => ({ name: entries[i].name, crc: e.crc, size: e.size })) };
}

const dv = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const le64 = (v, o) => v.getUint32(o, true) + v.getUint32(o + 4, true) * 2 ** 32;

/** Reader over `source = { size, read(offset, length) → Promise<Uint8Array> }`. */
export async function openArchive(source) {
  const size = source.size;
  if (size < 22) throw new Error("not a zip");
  const tailLength = Math.min(size, 65557);
  const tail = await source.read(size - tailLength, tailLength);
  const tv = dv(tail);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (tv.getUint32(i, true) === SIG.end) { eocd = i; break; }
  if (eocd < 0) throw new Error("corrupt: no end record (truncated?)");
  const eocdAbs = size - tailLength + eocd;
  let count = tv.getUint16(eocd + 10, true);
  let cdSize = tv.getUint32(eocd + 12, true);
  let cdStart = tv.getUint32(eocd + 16, true);
  if (eocdAbs >= 20) {
    const loc = await source.read(eocdAbs - 20, 20);
    const lv = dv(loc);
    if (lv.getUint32(0, true) === SIG.loc64) {
      const z = dv(await source.read(le64(lv, 8), 56));
      if (z.getUint32(0, true) !== SIG.end64) throw new Error("corrupt: bad zip64 end record");
      count = le64(z, 32); cdSize = le64(z, 40); cdStart = le64(z, 48);
    }
  }
  if (cdStart + cdSize > eocdAbs || cdSize > 64 * 2 ** 20 || count > 1e6) throw new Error("corrupt: bad central directory");
  const cd = await source.read(cdStart, cdSize);
  const cv = dv(cd);
  const dec = new TextDecoder("utf-8", { fatal: true });
  const entries = [];
  const seen = new Set();
  let p = 0;
  for (let k = 0; k < count; k++) {
    if (p + 46 > cd.length || cv.getUint32(p, true) !== SIG.central) throw new Error("corrupt: bad directory entry");
    const flags = cv.getUint16(p + 8, true), method = cv.getUint16(p + 10, true), crc = cv.getUint32(p + 16, true);
    const csize32 = cv.getUint32(p + 20, true);
    let size = cv.getUint32(p + 24, true);
    const nameLen = cv.getUint16(p + 28, true), extraLen = cv.getUint16(p + 30, true), commentLen = cv.getUint16(p + 32, true);
    let local = cv.getUint32(p + 42, true);
    const name = dec.decode(cd.subarray(p + 46, p + 46 + nameLen));
    for (let x = p + 46 + nameLen, end = x + extraLen; x + 4 <= end; ) {
      const id = cv.getUint16(x, true), len = cv.getUint16(x + 2, true);
      if (id === 1) {
        let q = x + 4;
        if (size === 0xffffffff) { size = le64(cv, q); q += 8; }
        if (csize32 === 0xffffffff) q += 8;
        if (local === 0xffffffff) local = le64(cv, q);
      }
      x += 4 + len;
    }
    if (!checkPath(name)) throw new Error(`unsafe path ${name}`);
    if (seen.has(name)) throw new Error(`duplicate ${name}`);
    seen.add(name);
    if (flags & 1) throw new Error(`encrypted entry ${name}`);
    if (method !== 0) throw new Error(`compressed entry ${name}`);
    entries.push({ name, crc, size, local });
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (entries[0]?.name !== "mimetype") throw new Error("corrupt: mimetype is not the first entry");

  async function dataStart(e) {
    const h = await source.read(e.local, 30);
    const hv = dv(h);
    if (hv.getUint32(0, true) !== SIG.local) throw new Error(`corrupt: bad local header ${e.name}`);
    const nameLen = hv.getUint16(26, true), extraLen = hv.getUint16(28, true);
    if (dec.decode(await source.read(e.local + 30, nameLen)) !== e.name) throw new Error(`corrupt: name mismatch ${e.name}`);
    const start = e.local + 30 + nameLen + extraLen;
    if (start + e.size > size) throw new Error(`corrupt: entry past end ${e.name}`);
    return start;
  }
  /** Streams one entry in chunks; checks CRC; calls `each(chunk)` (e.g. to hash or write). */
  async function verify(e, { chunk = 4 * 2 ** 20, each } = {}) {
    let at = await dataStart(e);
    let left = e.size;
    let crc = 0;
    while (left > 0) {
      const n = Math.min(chunk, left);
      const piece = await source.read(at, n);
      if (piece.length !== n) throw new Error(`corrupt: short entry ${e.name}`);
      crc = crc32(piece, crc);
      if (each) await each(piece);
      at += n;
      left -= n;
    }
    if (crc !== e.crc) throw new Error(`corrupt: CRC mismatch ${e.name}`);
    return true;
  }
  async function bytes(name, limit = 64 * 2 ** 20) {
    const e = entries.find((x) => x.name === name);
    if (!e) throw new Error(`missing ${name}`);
    if (e.size > limit) throw new Error(`${name} too large to read whole`);
    const out = new Uint8Array(e.size);
    let o = 0;
    await verify(e, { each: (c) => { out.set(c, o); o += c.length; } });
    return out;
  }
  return { entries, verify, bytes };
}

/** Browser source over a File/Blob. */
export const blobSource = (blob) => ({ size: blob.size, read: async (offset, length) => new Uint8Array(await blob.slice(offset, offset + length).arrayBuffer()) });
