// S1-0 spike · `.capiday` container prototype (docs/CAPIDAY_BACKUP_FORMAT.md).
// A store-only ZIP writer and reader that never hold more than one chunk of an
// entry in memory. Not part of the app build; S1-2 will move a reviewed copy
// into Native/Sources/LittleDaysUI/WebShell/.
//
// Writer: each entry's local header is written with zero CRC/sizes, the bytes
// are streamed (CRC-32 + SHA-256 computed on the way), then the header is
// patched in place (the file is seekable, so no data descriptor is needed).
// Entries stay < 4 GiB (media ≤ 50 MB); ZIP64 is used in the central
// directory when an offset or the directory itself passes 4 GiB / 65 535 items
// (or always, with `forceZip64`, to test readers cheaply).
//
// Reader: finds the (ZIP64) end record, reads the central directory, rejects
// unsafe or duplicate paths, non-STORE or encrypted entries, and verifies each
// entry by streaming it (CRC-32 against the directory, SHA-256 returned).
import Foundation
import CryptoKit

enum CapidayZipError: Error, CustomStringConvertible {
    case notZip, corrupt(String), unsafePath(String), unsupported(String), state(String)
    var description: String {
        switch self {
        case .notZip: return "not a zip"
        case .corrupt(let m): return "corrupt: \(m)"
        case .unsafePath(let p): return "unsafe path: \(p)"
        case .unsupported(let m): return "unsupported: \(m)"
        case .state(let m): return "state: \(m)"
        }
    }
}

struct CRC32 {
    // Slicing-by-8 tables: ~1–2 GB/s in release builds.
    static let tables: [[UInt32]] = {
        var t = Array(repeating: Array(repeating: UInt32(0), count: 256), count: 8)
        for i in 0..<256 {
            var c = UInt32(i)
            for _ in 0..<8 { c = (c & 1) != 0 ? 0xEDB8_8320 ^ (c >> 1) : c >> 1 }
            t[0][i] = c
        }
        for i in 0..<256 {
            for k in 1..<8 { t[k][i] = (t[k - 1][i] >> 8) ^ t[0][Int(t[k - 1][i] & 0xFF)] }
        }
        return t
    }()
    private var value: UInt32 = 0xFFFF_FFFF

    mutating func update(_ buffer: UnsafeRawBufferPointer) {
        var c = value
        let t0 = CRC32.tables[0], t1 = CRC32.tables[1], t2 = CRC32.tables[2], t3 = CRC32.tables[3]
        let t4 = CRC32.tables[4], t5 = CRC32.tables[5], t6 = CRC32.tables[6], t7 = CRC32.tables[7]
        var i = 0
        let n = buffer.count
        while i + 8 <= n {
            let one = UInt32(buffer[i]) | UInt32(buffer[i + 1]) << 8 | UInt32(buffer[i + 2]) << 16 | UInt32(buffer[i + 3]) << 24
            let two = UInt32(buffer[i + 4]) | UInt32(buffer[i + 5]) << 8 | UInt32(buffer[i + 6]) << 16 | UInt32(buffer[i + 7]) << 24
            let x = one ^ c
            c = t7[Int(x & 0xFF)] ^ t6[Int((x >> 8) & 0xFF)] ^ t5[Int((x >> 16) & 0xFF)] ^ t4[Int(x >> 24)]
                ^ t3[Int(two & 0xFF)] ^ t2[Int((two >> 8) & 0xFF)] ^ t1[Int((two >> 16) & 0xFF)] ^ t0[Int(two >> 24)]
            i += 8
        }
        while i < n {
            c = t0[Int((c ^ UInt32(buffer[i])) & 0xFF)] ^ (c >> 8)
            i += 1
        }
        value = c
    }
    mutating func update(_ data: Data) { data.withUnsafeBytes { update($0) } }
    var final: UInt32 { value ^ 0xFFFF_FFFF }
}

private extension Data {
    mutating func u16(_ v: UInt16) { Swift.withUnsafeBytes(of: v.littleEndian) { append(contentsOf: $0) } }
    mutating func u32(_ v: UInt32) { Swift.withUnsafeBytes(of: v.littleEndian) { append(contentsOf: $0) } }
    mutating func u64(_ v: UInt64) { Swift.withUnsafeBytes(of: v.littleEndian) { append(contentsOf: $0) } }
    func le16(_ o: Int) -> UInt16 { UInt16(self[startIndex + o]) | UInt16(self[startIndex + o + 1]) << 8 }
    func le32(_ o: Int) -> UInt32 { (0..<4).reduce(UInt32(0)) { $0 | UInt32(self[startIndex + o + $1]) << (8 * UInt32($1)) } }
    func le64(_ o: Int) -> UInt64 { (0..<8).reduce(UInt64(0)) { $0 | UInt64(self[startIndex + o + $1]) << (8 * UInt64($1)) } }
}

enum CapidayPaths {
    /// docs/CAPIDAY_BACKUP_FORMAT.md §3: only these names, nothing else.
    static func check(_ name: String) throws {
        let fixed: Set<String> = ["mimetype", "header.json", "state.json", "manifest.json", "manifest.sig.json"]
        if fixed.contains(name) { return }
        let parts = name.split(separator: "/", omittingEmptySubsequences: false)
        guard parts.count == 2, parts[0] == "media" else { throw CapidayZipError.unsafePath(name) }
        let file = parts[1]
        let pieces = file.split(separator: ".", omittingEmptySubsequences: false)
        guard pieces.count == 2,
              (1...64).contains(pieces[0].count), pieces[0].allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-") }),
              (1...8).contains(pieces[1].count), pieces[1].allSatisfy({ $0.isASCII && ($0.isLowercase || $0.isNumber) })
        else { throw CapidayZipError.unsafePath(name) }
    }
}

final class CapidayZipWriter {
    struct Entry { let name: String; let offset: UInt64; var crc: UInt32; var size: UInt64; var sha256: String }
    private let handle: FileHandle
    private(set) var offset: UInt64 = 0
    private(set) var entries: [Entry] = []
    private var names = Set<String>()
    private var current: (index: Int, crc: CRC32, sha: SHA256, size: UInt64)?
    private let dosTime: UInt16, dosDate: UInt16
    let forceZip64: Bool

    init(url: URL, date: Date = Date(), forceZip64: Bool = false) throws {
        guard FileManager.default.createFile(atPath: url.path, contents: nil) else { throw CapidayZipError.state("cannot create \(url.path)") }
        handle = try FileHandle(forWritingTo: url)
        self.forceZip64 = forceZip64
        let c = Calendar(identifier: .gregorian).dateComponents(in: TimeZone(identifier: "UTC")!, from: date)
        dosTime = UInt16((c.hour ?? 0) << 11 | (c.minute ?? 0) << 5 | (c.second ?? 0) / 2)
        dosDate = UInt16(max(0, (c.year ?? 1980) - 1980) << 9 | (c.month ?? 1) << 5 | (c.day ?? 1))
    }

    private func put(_ data: Data) throws {
        try handle.write(contentsOf: data)
        offset += UInt64(data.count)
    }

    func begin(_ name: String) throws {
        guard current == nil else { throw CapidayZipError.state("entry still open") }
        try CapidayPaths.check(name)
        guard names.insert(name).inserted else { throw CapidayZipError.unsafePath("duplicate \(name)") }
        let nameData = Data(name.utf8)
        var h = Data()
        h.u32(0x0403_4B50); h.u16(20); h.u16(0x0800); h.u16(0) // signature, version, UTF-8 names, STORE
        h.u16(dosTime); h.u16(dosDate)
        h.u32(0); h.u32(0); h.u32(0) // crc, sizes: patched in end()
        h.u16(UInt16(nameData.count)); h.u16(0)
        h.append(nameData)
        entries.append(Entry(name: name, offset: offset, crc: 0, size: 0, sha256: ""))
        try put(h)
        current = (entries.count - 1, CRC32(), SHA256(), 0)
    }

    func write(_ chunk: Data) throws {
        guard var c = current else { throw CapidayZipError.state("no open entry") }
        c.crc.update(chunk)
        c.sha.update(data: chunk)
        c.size += UInt64(chunk.count)
        guard c.size < 0xFFFF_FFFF else { throw CapidayZipError.unsupported("entry ≥ 4 GiB") }
        current = c
        try put(chunk)
    }

    @discardableResult
    func end() throws -> Entry {
        guard let c = current else { throw CapidayZipError.state("no open entry") }
        let crc = c.crc.final
        let sha = c.sha.finalize().map { String(format: "%02x", $0) }.joined()
        var patch = Data()
        patch.u32(crc); patch.u32(UInt32(c.size)); patch.u32(UInt32(c.size))
        try handle.seek(toOffset: entries[c.index].offset + 14)
        try handle.write(contentsOf: patch)
        try handle.seek(toOffset: offset)
        entries[c.index].crc = crc
        entries[c.index].size = c.size
        entries[c.index].sha256 = sha
        current = nil
        return entries[c.index]
    }

    func add(_ name: String, _ data: Data) throws -> Entry {
        try begin(name)
        try write(data)
        return try end()
    }

    func finish() throws {
        guard current == nil else { throw CapidayZipError.state("entry still open") }
        let cdStart = offset
        for e in entries {
            let nameData = Data(e.name.utf8)
            let bigOffset = forceZip64 || e.offset >= 0xFFFF_FFFF
            var extra = Data()
            if bigOffset { extra.u16(0x0001); extra.u16(8); extra.u64(e.offset) }
            var r = Data()
            r.u32(0x0201_4B50); r.u16(0x031E); r.u16(bigOffset ? 45 : 20) // made by UNIX 3.0; needed
            r.u16(0x0800); r.u16(0); r.u16(dosTime); r.u16(dosDate)
            r.u32(e.crc); r.u32(UInt32(e.size)); r.u32(UInt32(e.size))
            r.u16(UInt16(nameData.count)); r.u16(UInt16(extra.count)); r.u16(0)
            r.u16(0); r.u16(0); r.u32(0o100644 << 16)
            r.u32(bigOffset ? 0xFFFF_FFFF : UInt32(e.offset))
            r.append(nameData); r.append(extra)
            try put(r)
        }
        let cdSize = offset - cdStart
        let need64 = forceZip64 || entries.count >= 0xFFFF || cdStart >= 0xFFFF_FFFF || cdSize >= 0xFFFF_FFFF
        if need64 {
            let z64 = offset
            var z = Data()
            z.u32(0x0606_4B50); z.u64(44); z.u16(0x031E); z.u16(45); z.u32(0); z.u32(0)
            z.u64(UInt64(entries.count)); z.u64(UInt64(entries.count)); z.u64(cdSize); z.u64(cdStart)
            z.u32(0x0706_4B50); z.u32(0); z.u64(z64); z.u32(1)
            try put(z)
        }
        var end = Data()
        end.u32(0x0605_4B50); end.u16(0); end.u16(0)
        let count = need64 ? UInt16(0xFFFF) : UInt16(entries.count)
        end.u16(count); end.u16(count)
        end.u32(need64 ? 0xFFFF_FFFF : UInt32(cdSize))
        end.u32(need64 ? 0xFFFF_FFFF : UInt32(cdStart))
        end.u16(0)
        try put(end)
        try handle.synchronize()
        try handle.close()
    }
}

final class CapidayZipReader {
    struct Entry { let name: String; let crc: UInt32; let size: UInt64; let localOffset: UInt64; let flags: UInt16; let method: UInt16 }
    let url: URL
    private let handle: FileHandle
    let fileSize: UInt64
    private(set) var entries: [Entry] = []

    init(url: URL) throws {
        self.url = url
        handle = try FileHandle(forReadingFrom: url)
        fileSize = try handle.seekToEnd()
        try parse()
    }
    deinit { try? handle.close() }

    private func read(at: UInt64, count: Int) throws -> Data {
        guard at + UInt64(count) <= fileSize else { throw CapidayZipError.corrupt("read past end") }
        try handle.seek(toOffset: at)
        guard let d = try handle.read(upToCount: count), d.count == count else { throw CapidayZipError.corrupt("short read") }
        return d
    }

    private func parse() throws {
        guard fileSize >= 22 else { throw CapidayZipError.notZip }
        let tailLength = Int(min(fileSize, 65_557))
        let tail = try read(at: fileSize - UInt64(tailLength), count: tailLength)
        var eocd = -1
        var i = tail.count - 22
        while i >= 0 {
            if tail.le32(i) == 0x0605_4B50 { eocd = i; break }
            i -= 1
        }
        guard eocd >= 0 else { throw CapidayZipError.corrupt("no end record (truncated?)") }
        let eocdAbs = fileSize - UInt64(tailLength) + UInt64(eocd)
        var count = UInt64(tail.le16(eocd + 10))
        var cdSize = UInt64(tail.le32(eocd + 12))
        var cdStart = UInt64(tail.le32(eocd + 16))
        if eocdAbs >= 20, try read(at: eocdAbs - 20, count: 4).le32(0) == 0x0706_4B50 {
            let loc = try read(at: eocdAbs - 20, count: 20)
            let z64At = loc.le64(8)
            let z = try read(at: z64At, count: 56)
            guard z.le32(0) == 0x0606_4B50 else { throw CapidayZipError.corrupt("bad zip64 end record") }
            count = z.le64(32); cdSize = z.le64(40); cdStart = z.le64(48)
        }
        guard cdStart + cdSize <= eocdAbs, cdSize < 64 * 1024 * 1024, count < 1_000_000 else { throw CapidayZipError.corrupt("bad central directory") }
        let cd = try read(at: cdStart, count: Int(cdSize))
        var p = 0
        var seen = Set<String>()
        for _ in 0..<count {
            guard p + 46 <= cd.count, cd.le32(p) == 0x0201_4B50 else { throw CapidayZipError.corrupt("bad directory entry") }
            let flags = cd.le16(p + 8), method = cd.le16(p + 10), crc = cd.le32(p + 16)
            var size = UInt64(cd.le32(p + 24))
            let nameLen = Int(cd.le16(p + 28)), extraLen = Int(cd.le16(p + 30)), commentLen = Int(cd.le16(p + 32))
            var local = UInt64(cd.le32(p + 42))
            guard p + 46 + nameLen + extraLen + commentLen <= cd.count else { throw CapidayZipError.corrupt("directory overflow") }
            guard let name = String(data: cd.subdata(in: (cd.startIndex + p + 46)..<(cd.startIndex + p + 46 + nameLen)), encoding: .utf8) else { throw CapidayZipError.corrupt("name not UTF-8") }
            var x = p + 46 + nameLen
            let xEnd = x + extraLen
            while x + 4 <= xEnd {
                let id = cd.le16(x), len = Int(cd.le16(x + 2))
                if id == 0x0001 {
                    var q = x + 4
                    if size == 0xFFFF_FFFF { size = cd.le64(q); q += 8 } // uncompressed
                    if cd.le32(p + 20) == 0xFFFF_FFFF { q += 8 } // compressed
                    if local == 0xFFFF_FFFF { local = cd.le64(q) }
                }
                x += 4 + len
            }
            try CapidayPaths.check(name)
            guard seen.insert(name).inserted else { throw CapidayZipError.unsafePath("duplicate \(name)") }
            guard flags & 0x1 == 0 else { throw CapidayZipError.unsupported("encrypted entry \(name)") }
            guard method == 0 else { throw CapidayZipError.unsupported("compressed entry \(name)") }
            entries.append(Entry(name: name, crc: crc, size: size, localOffset: local, flags: flags, method: method))
            p += 46 + nameLen + extraLen + commentLen
        }
        guard entries.first?.name == "mimetype" else { throw CapidayZipError.corrupt("mimetype is not the first entry") }
    }

    private func dataStart(_ e: Entry) throws -> UInt64 {
        let h = try read(at: e.localOffset, count: 30)
        guard h.le32(0) == 0x0403_4B50 else { throw CapidayZipError.corrupt("bad local header \(e.name)") }
        let nameLen = UInt64(h.le16(26)), extraLen = UInt64(h.le16(28))
        let name = try read(at: e.localOffset + 30, count: Int(nameLen))
        guard String(data: name, encoding: .utf8) == e.name else { throw CapidayZipError.corrupt("local/central name mismatch \(e.name)") }
        let start = e.localOffset + 30 + nameLen + extraLen
        guard start + e.size <= fileSize else { throw CapidayZipError.corrupt("entry past end \(e.name)") }
        return start
    }

    /// Streams the entry (chunk by chunk), checks its CRC-32, returns its SHA-256.
    func verify(_ e: Entry, chunk: Int = 1 << 20, each: ((Data) throws -> Void)? = nil) throws -> String {
        var at = try dataStart(e)
        var left = e.size
        var crc = CRC32()
        var sha = SHA256()
        try handle.seek(toOffset: at)
        while left > 0 {
            let n = Int(min(UInt64(chunk), left))
            guard let d = try handle.read(upToCount: n), d.count == n else { throw CapidayZipError.corrupt("short entry \(e.name)") }
            crc.update(d)
            sha.update(data: d)
            try each?(d)
            left -= UInt64(n)
            at += UInt64(n)
        }
        guard crc.final == e.crc else { throw CapidayZipError.corrupt("CRC mismatch \(e.name)") }
        return sha.finalize().map { String(format: "%02x", $0) }.joined()
    }

    func data(_ name: String, limit: Int = 64 << 20) throws -> Data {
        guard let e = entries.first(where: { $0.name == name }) else { throw CapidayZipError.corrupt("missing \(name)") }
        guard e.size <= UInt64(limit) else { throw CapidayZipError.unsupported("\(name) too large to read whole") }
        var out = Data(capacity: Int(e.size))
        _ = try verify(e) { out.append($0) }
        return out
    }
}
