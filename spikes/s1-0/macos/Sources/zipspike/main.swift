// S1-0 spike harness: container throughput, peak memory, interop and hostile files.
// Synthetic data only (pseudo-random bytes), written under a temp folder.
import Foundation
import CryptoKit

func peakRSSMB() -> Double {
    var u = rusage(); getrusage(RUSAGE_SELF, &u)
    return Double(u.ru_maxrss) / 1_048_576 // macOS: bytes
}
func now() -> Double { Date().timeIntervalSince1970 }
func hex(_ d: some Sequence<UInt8>) -> String { d.map { String(format: "%02x", $0) }.joined() }

/// Fast pseudo-random 1 MiB chunk (xorshift), different per seed.
func chunk(_ seed: UInt64, size: Int = 1 << 20) -> Data {
    var x = seed &* 0x9E37_79B9_7F4A_7C15 | 1
    var d = Data(count: size)
    d.withUnsafeMutableBytes { raw in
        let p = raw.bindMemory(to: UInt64.self)
        for i in 0..<p.count { x ^= x << 13; x ^= x >> 7; x ^= x << 17; p[i] = x }
    }
    return d
}

let mime = Data("application/vnd.capiday.backup+zip".utf8)

/// Writes mimetype + header + state + `count` media of `mb` MiB each; returns per-media SHA.
func build(_ url: URL, count: Int, mb: Int, forceZip64: Bool) throws -> [String: String] {
    let w = try CapidayZipWriter(url: url, forceZip64: forceZip64)
    _ = try w.add("mimetype", mime)
    _ = try w.add("header.json", Data(#"{"format":"capiday-backup","formatVersion":"1.0"}"#.utf8))
    _ = try w.add("state.json", Data(#"{"schemaVersion":1,"entries":[]}"#.utf8))
    var shas: [String: String] = [:]
    for i in 0..<count {
        let name = "media/m\(i)-0000-synthetic.jpg"
        try w.begin(name)
        for c in 0..<mb { try w.write(chunk(UInt64(i * 100_000 + c))) }
        shas[name] = try w.end().sha256
    }
    let manifest = try JSONSerialization.data(withJSONObject: ["media": shas.map { ["path": $0.key, "sha256": $0.value] }])
    _ = try w.add("manifest.json", manifest)
    try w.finish()
    return shas
}

func verifyAll(_ url: URL, expect: [String: String]) throws -> Int {
    let r = try CapidayZipReader(url: url)
    var ok = 0
    for e in r.entries where e.name.hasPrefix("media/") {
        let sha = try r.verify(e)
        guard sha == expect[e.name] else { throw CapidayZipError.corrupt("SHA mismatch \(e.name)") }
        ok += 1
    }
    return ok
}

let mode = CommandLine.arguments.dropFirst().first ?? "small"
let dir = URL(fileURLWithPath: CommandLine.arguments.dropFirst(2).first ?? NSTemporaryDirectory()).appendingPathComponent("capiday-spike-\(getpid())")
try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
var report: [String: Any] = ["mode": mode, "dir": dir.path]

switch mode {
case "interop":
    // Small archives for external tools (unzip -t, python zipfile): normal and forced ZIP64.
    for (name, z64) in [("normal.capiday", false), ("zip64.capiday", true)] {
        let url = dir.appendingPathComponent(name)
        let shas = try build(url, count: 5, mb: 3, forceZip64: z64)
        report[name] = ["verified": try verifyAll(url, expect: shas), "bytes": try FileManager.default.attributesOfItem(atPath: url.path)[.size] ?? 0]
    }
case "hostile":
    // Each must be rejected by the reader.
    let base = dir.appendingPathComponent("base.capiday")
    let shas = try build(base, count: 3, mb: 1, forceZip64: false)
    var cases: [String: String] = [:]
    let data = try Data(contentsOf: base)
    func attempt(_ label: String, _ bytes: Data) {
        let u = dir.appendingPathComponent("\(label).capiday")
        try? bytes.write(to: u)
        do { _ = try verifyAll(u, expect: shas); cases[label] = "ACCEPTED (bad)" } catch { cases[label] = "rejected: \(error)" }
    }
    attempt("truncated", data.prefix(data.count - 40))
    var flipped = data; flipped[flipped.count / 2] ^= 0xFF; attempt("flipped-byte", flipped)
    attempt("half", data.prefix(data.count / 2))
    // Unsafe names: rewrite one media name in place (same length) in both headers.
    func renamed(_ from: String, _ to: String) -> Data {
        var d = data
        let a = Array(from.utf8), b = Array(to.utf8)
        precondition(a.count == b.count)
        var i = 0
        while i + a.count <= d.count {
            if d[i..<(i + a.count)].elementsEqual(a) { d.replaceSubrange(i..<(i + a.count), with: b) }
            i += 1
        }
        return d
    }
    attempt("dotdot", renamed("media/m0-0000-synthetic.jpg", "media/../000-synthetic.jpgx"))
    attempt("absolute", renamed("media/m0-0000-synthetic.jpg", "/media/m0-000-synthetic.jpg"))
    attempt("backslash", renamed("media/m0-0000-synthetic.jpg", "media\\m0-0000-synthetic.jpg"))
    attempt("duplicate", renamed("media/m1-0000-synthetic.jpg", "media/m0-0000-synthetic.jpg"))
    report["cases"] = cases
case "big":
    // GiB-scale streaming: count × 50 MiB, offsets beyond 4 GiB when count ≥ 83.
    let count = Int(CommandLine.arguments.dropFirst(3).first ?? "88") ?? 88
    let url = dir.appendingPathComponent("big.capiday")
    let t0 = now()
    let shas = try build(url, count: count, mb: 50, forceZip64: false)
    let t1 = now()
    let n = try verifyAll(url, expect: shas)
    let t2 = now()
    let size = (try FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber)?.doubleValue ?? 0
    report["entries"] = n
    report["gib"] = size / 1_073_741_824
    report["writeMBps"] = size / 1_048_576 / (t1 - t0)
    report["verifyMBps"] = size / 1_048_576 / (t2 - t1)
    report["path"] = url.path
default:
    let url = dir.appendingPathComponent("small.capiday")
    let shas = try build(url, count: 10, mb: 2, forceZip64: false)
    report["verified"] = try verifyAll(url, expect: shas)
}
report["peakRSSMB"] = peakRSSMB()
let out = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
print(String(data: out, encoding: .utf8)!)
