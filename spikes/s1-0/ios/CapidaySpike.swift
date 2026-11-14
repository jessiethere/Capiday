// S1-0 spike · iOS side. Only compiled into a throw-away copy of the app
// (spikes/s1-0/apply.py), never into the real build. Launch argument
// `-CapidaySpike YES` opens littledays://app/spike.html instead of the app.
//
// Measures: (1) can a WKURLSchemeHandler receive large request bodies from
// fetch(PUT, Blob)? (2) throughput of base64 chunks through a reply-capable
// message handler; (3) streaming a large response to the page (pull model for
// restore); (4) building + verifying a ~1 GB `.capiday` natively with the
// spike container code, with the app process's peak memory footprint.
import Foundation
import WebKit
import CryptoKit

enum CapidaySpike {
    static var enabled: Bool { UserDefaults.standard.bool(forKey: "CapidaySpike") }
    static let url = URL(string: "littledays://app/spike.html")!
    static var tmp: URL { FileManager.default.temporaryDirectory.appendingPathComponent("capiday-spike", isDirectory: true) }

    static func footprintMB() -> Double {
        var info = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size)
        let kr = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count) }
        }
        return kr == KERN_SUCCESS ? Double(info.phys_footprint) / 1_048_576 : -1
    }

    /// Samples the footprint every 20 ms while `work` runs.
    static func peak<T>(_ work: () throws -> T) rethrows -> (T, Double, Double) {
        let start = footprintMB()
        var top = start
        let lock = NSLock()
        let timer = DispatchSource.makeTimerSource(queue: .global(qos: .utility))
        timer.schedule(deadline: .now(), repeating: .milliseconds(20))
        timer.setEventHandler { let f = footprintMB(); lock.lock(); top = max(top, f); lock.unlock() }
        timer.resume()
        defer { timer.cancel() }
        let value = try work()
        lock.lock(); let p = top; lock.unlock()
        return (value, start, p)
    }

    static func hex(_ d: SHA256.Digest) -> String { d.map { String(format: "%02x", $0) }.joined() }

    static func respond(_ task: WKURLSchemeTask, _ object: Any, status: Int = 200) {
        let body = (try? JSONSerialization.data(withJSONObject: object)) ?? Data("{}".utf8)
        DispatchQueue.main.async {
            let r = HTTPURLResponse(url: task.request.url!, statusCode: status, httpVersion: "HTTP/1.1",
                                    headerFields: ["Content-Type": "application/json", "Content-Length": String(body.count)])!
            task.didReceive(r)
            task.didReceive(body)
            task.didFinish()
        }
    }

    /// `littledays://app/spike/...`
    static func handle(_ task: WKURLSchemeTask) {
        let request = task.request
        guard let url = request.url, let parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }
        let q = Dictionary(uniqueKeysWithValues: (parts.queryItems ?? []).map { ($0.name, $0.value ?? "") })
        DispatchQueue.global(qos: .userInitiated).async {
            switch url.path {
            case "/spike/put":
                let t0 = Date()
                var sha = SHA256()
                var bytes = 0
                var via = "none"
                let ((), f0, fp) = peak {
                    if let body = request.httpBody {
                        via = "httpBody"; sha.update(data: body); bytes = body.count
                    } else if let stream = request.httpBodyStream {
                        via = "httpBodyStream"
                        stream.open()
                        var buffer = [UInt8](repeating: 0, count: 1 << 20)
                        while true {
                            let n = stream.read(&buffer, maxLength: buffer.count)
                            if n <= 0 { break }
                            buffer.withUnsafeBytes { sha.update(bufferPointer: UnsafeRawBufferPointer(rebasing: $0[0..<n])) }
                            bytes += n
                        }
                        stream.close()
                    }
                }
                respond(task, ["via": via, "bytes": bytes, "sha256": hex(sha.finalize()), "ms": Int(Date().timeIntervalSince(t0) * 1000),
                               "nativeFootprintStartMB": f0, "nativePeakMB": fp, "method": request.httpMethod ?? ""])
            case "/spike/get":
                // Pull model (restore): stream N MiB in 1 MiB chunks.
                let mb = Int(q["mb"] ?? "50") ?? 50
                DispatchQueue.main.async {
                    let r = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                            headerFields: ["Content-Type": "application/octet-stream", "Content-Length": String(mb << 20)])!
                    task.didReceive(r)
                }
                var chunk = Data(count: 1 << 20)
                for i in 0..<mb {
                    chunk[0] = UInt8(i & 0xFF)
                    let piece = chunk
                    DispatchQueue.main.sync { task.didReceive(piece) }
                }
                DispatchQueue.main.async { task.didFinish() }
            case "/spike/zip":
                // Build + verify count × 50 MiB synthetic media natively (no page memory involved).
                let count = Int(q["count"] ?? "20") ?? 20
                try? FileManager.default.createDirectory(at: tmp, withIntermediateDirectories: true)
                let file = tmp.appendingPathComponent("spike.capiday")
                var out: [String: Any] = ["count": count]
                do {
                    let t0 = Date()
                    let ((), f0, fpWrite) = try peak {
                        let w = try CapidayZipWriter(url: file)
                        _ = try w.add("mimetype", Data("application/vnd.capiday.backup+zip".utf8))
                        _ = try w.add("header.json", Data(#"{"format":"capiday-backup","formatVersion":"1.0"}"#.utf8))
                        var block = Data(count: 1 << 20)
                        for i in 0..<count {
                            try w.begin("media/s\(i)-spike.mp4")
                            for c in 0..<50 { block[0] = UInt8(c); block[1] = UInt8(i & 0xFF); try w.write(block) }
                            try w.end()
                        }
                        _ = try w.add("manifest.json", Data(#"{"spike":true}"#.utf8))
                        try w.finish()
                    }
                    let t1 = Date()
                    let (verified, _, fpVerify) = try peak { () -> Int in
                        let r = try CapidayZipReader(url: file)
                        var n = 0
                        for e in r.entries { _ = try r.verify(e); n += 1 }
                        return n
                    }
                    let t2 = Date()
                    let size = (try FileManager.default.attributesOfItem(atPath: file.path)[.size] as? NSNumber)?.doubleValue ?? 0
                    out["mb"] = size / 1_048_576
                    out["writeMBps"] = size / 1_048_576 / t1.timeIntervalSince(t0)
                    out["verifyMBps"] = size / 1_048_576 / t2.timeIntervalSince(t1)
                    out["entriesVerified"] = verified
                    out["footprintStartMB"] = f0
                    out["peakWriteMB"] = fpWrite
                    out["peakVerifyMB"] = fpVerify
                    out["freeImportantGB"] = ((try? URL(fileURLWithPath: NSHomeDirectory()).resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey]))?.volumeAvailableCapacityForImportantUsage).map { Double($0) / 1_073_741_824 } ?? -1
                } catch {
                    out["error"] = String(describing: error)
                }
                try? FileManager.default.removeItem(at: file)
                respond(task, out)
            default:
                respond(task, ["error": "no route"], status: 404)
            }
        }
    }
}

/// Reply-capable message handler: base64 chunks → file (+SHA), and the final report.
final class CapidaySpikeChunks: NSObject, WKScriptMessageHandlerWithReply {
    static let name = "spikeChunk"
    private var handle: FileHandle?
    private var sha = SHA256()
    private var bytes = 0
    private var start = Date()
    private var peakMB = 0.0

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let op = body["op"] as? String else { return replyHandler(nil, "bad message") }
        switch op {
        case "begin":
            try? FileManager.default.createDirectory(at: CapidaySpike.tmp, withIntermediateDirectories: true)
            let url = CapidaySpike.tmp.appendingPathComponent("chunks.bin")
            FileManager.default.createFile(atPath: url.path, contents: nil)
            handle = try? FileHandle(forWritingTo: url)
            sha = SHA256(); bytes = 0; start = Date(); peakMB = CapidaySpike.footprintMB()
            replyHandler(["ok": true], nil)
        case "chunk":
            guard let b64 = body["b64"] as? String, let data = Data(base64Encoded: b64) else { return replyHandler(nil, "bad chunk") }
            try? handle?.write(contentsOf: data)
            sha.update(data: data)
            bytes += data.count
            peakMB = max(peakMB, CapidaySpike.footprintMB())
            replyHandler(["ok": true, "bytes": bytes], nil)
        case "end":
            try? handle?.close()
            handle = nil
            try? FileManager.default.removeItem(at: CapidaySpike.tmp.appendingPathComponent("chunks.bin"))
            replyHandler(["bytes": bytes, "sha256": CapidaySpike.hex(sha.finalize()), "ms": Int(Date().timeIntervalSince(start) * 1000), "nativePeakMB": peakMB], nil)
        case "done":
            let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let text = (body["json"] as? String) ?? "{}"
            try? Data(text.utf8).write(to: docs.appendingPathComponent("spike-results.json"))
            NSLog("[CapidaySpike] results written")
            replyHandler(["ok": true], nil)
        default:
            replyHandler(nil, "unknown op")
        }
    }
}
