import Foundation
import WebKit

/// V10.78 · DS-04…DS-08 · Automatic backups to the app's own iCloud container
/// (iCloud Drive, `iCloud.com.capiday.app/Documents/Backups`).
///
/// The page makes the `.capiday` file and checks it (every size and SHA-256,
/// read back) before handing it over as a download named
/// `Capiday-Auto-….capiday` (see LittleDaysWebCoordinator). Here it is copied
/// into the container with a file coordinator, its size is checked, and old
/// backups are pruned — only once the newest one has finished uploading.
/// The page asks through `capidayICloud` messages and hears back through
/// `window.capidayICloudReply(json)`; nothing here reads or changes the journal.
///
/// Without the iCloud capability (or with iCloud signed out / iCloud Drive
/// off) the container is nil: every answer says `available: false`, and the
/// manual backup stays as it was.
@MainActor
public final class LittleDaysICloudBackup: NSObject, WKScriptMessageHandler {
    public static let shared = LittleDaysICloudBackup()
    static let name = "capidayICloud"
    static let containerID = "iCloud.com.capiday.app"

    weak var webView: WKWebView?
    private let queue = DispatchQueue(label: "capiday.icloud", qos: .utility)

    nonisolated static func isAutoBackup(_ name: String) -> Bool {
        name.hasPrefix("Capiday-Auto-") && validName(name)
    }
    /// Files this code may read or write: our own backups only —
    /// "Capiday-Auto-…" / "Capiday-Backup-…" + letters, digits, "-" + ".capiday".
    nonisolated static func validName(_ name: String) -> Bool {
        guard name.hasSuffix(".capiday") else { return false }
        let stem: Substring
        if name.hasPrefix("Capiday-Auto-") { stem = name.dropFirst("Capiday-Auto-".count).dropLast(".capiday".count) }
        else if name.hasPrefix("Capiday-Backup-") { stem = name.dropFirst("Capiday-Backup-".count).dropLast(".capiday".count) }
        else { return false }
        return (1...40).contains(stem.count) && stem.allSatisfy { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-") }
    }

    /// The backups folder in the container (created if needed); nil without iCloud.
    nonisolated static func folder() -> URL? {
        guard FileManager.default.ubiquityIdentityToken != nil,
              let root = FileManager.default.url(forUbiquityContainerIdentifier: containerID) else { return nil }
        let folder = root.appendingPathComponent("Documents", isDirectory: true).appendingPathComponent("Backups", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == Self.name, let body = message.body as? [String: Any], let cmd = body["cmd"] as? String else { return }
        let id = body["id"] as? String ?? ""
        switch cmd {
        case "status": status(id: id)
        case "prepare": prepare(id: id, name: body["name"] as? String ?? "")
        default: reply(["id": id, "cmd": cmd, "ok": false, "err": "unknown"])
        }
    }

    // MARK: status (available, and the backups there with their upload state)

    private func status(id: String) {
        queue.async {
            guard let folder = Self.folder() else {
                Task { @MainActor in self.reply(["id": id, "cmd": "status", "ok": true, "available": false]) }
                return
            }
            let list = Self.backups(in: folder)
            Task { @MainActor in self.reply(["id": id, "cmd": "status", "ok": true, "available": true, "backups": list]) }
        }
    }

    nonisolated static func backups(in folder: URL) -> [[String: Any]] {
        let keys: [URLResourceKey] = [.fileSizeKey, .contentModificationDateKey, .ubiquitousItemIsUploadedKey, .ubiquitousItemIsUploadingKey, .ubiquitousItemDownloadingStatusKey, .ubiquitousItemUploadingErrorKey]
        let items = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: keys, options: [])) ?? []
        var out: [[String: Any]] = []
        let iso = ISO8601DateFormatter()
        for url in items {
            // A file not on this phone yet shows as ".Name.capiday.icloud".
            var name = url.lastPathComponent
            if name.hasPrefix("."), name.hasSuffix(".icloud") { name = String(name.dropFirst().dropLast(7)) }
            guard validName(name) else { continue }
            let v = try? url.resourceValues(forKeys: Set(keys))
            out.append([
                "name": name,
                "size": v?.fileSize ?? 0,
                "date": v?.contentModificationDate.map { iso.string(from: $0) } ?? "",
                "uploaded": v?.ubiquitousItemIsUploaded ?? false,
                "uploading": v?.ubiquitousItemIsUploading ?? false,
                "downloaded": v?.ubiquitousItemDownloadingStatus == .current || url.lastPathComponent == name && v?.ubiquitousItemDownloadingStatus == nil,
                "uploadError": v?.ubiquitousItemUploadingError != nil,
            ])
        }
        return out.sorted { ($0["date"] as? String ?? "") > ($1["date"] as? String ?? "") }
    }

    // MARK: save (called by the coordinator when an automatic backup finished downloading)

    func save(_ temporary: URL) {
        let name = temporary.lastPathComponent
        let expected = (try? temporary.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        queue.async {
            defer { try? FileManager.default.removeItem(at: temporary) }
            guard let folder = Self.folder() else {
                Task { @MainActor in self.done(["status": "unavailable"]) }
                return
            }
            let destination = folder.appendingPathComponent(name)
            var coordinationError: NSError?
            var writeError: Error?
            NSFileCoordinator().coordinate(writingItemAt: destination, options: .forReplacing, error: &coordinationError) { url in
                do {
                    let part = url.deletingLastPathComponent().appendingPathComponent(".\(name).partial")
                    try? FileManager.default.removeItem(at: part)
                    try FileManager.default.copyItem(at: temporary, to: part)
                    try? FileManager.default.removeItem(at: url)
                    try FileManager.default.moveItem(at: part, to: url)
                } catch { writeError = error }
            }
            let size = (try? destination.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? -1
            if coordinationError != nil || writeError != nil || size != expected || expected <= 0 {
                let space = (writeError as NSError?)?.code == NSFileWriteOutOfSpaceError
                Task { @MainActor in self.done(["status": "failed", "err": space ? "space" : "write", "name": name]) }
                return
            }
            Self.prune(folder)
            Task { @MainActor in self.done(["status": "saved", "name": name, "size": size]) }
        }
    }

    /// Keep the 3 newest plus the newest of each of the last 6 months; delete
    /// the others only when the newest backup has finished uploading (so there
    /// is always a complete copy in iCloud).
    nonisolated static func prune(_ folder: URL) {
        let list = backups(in: folder).filter { ($0["name"] as? String ?? "").hasPrefix("Capiday-Auto-") }
        guard let newest = list.first, newest["uploaded"] as? Bool == true else { return }
        var keep = Set(list.prefix(3).compactMap { $0["name"] as? String })
        var months = Set<String>()
        for item in list {
            let month = String((item["date"] as? String ?? "").prefix(7))
            guard !month.isEmpty, months.count < 6 else { continue }
            if months.insert(month).inserted, let name = item["name"] as? String { keep.insert(name) }
        }
        for item in list {
            guard let name = item["name"] as? String, !keep.contains(name) else { continue }
            let url = folder.appendingPathComponent(name)
            var error: NSError?
            NSFileCoordinator().coordinate(writingItemAt: url, options: .forDeleting, error: &error) { try? FileManager.default.removeItem(at: $0) }
        }
    }

    // MARK: restore (make sure the file is on this phone; the page then reads it
    // through littledays://app/__icloud/<name>)

    private func prepare(id: String, name: String) {
        guard Self.validName(name) else { return reply(["id": id, "cmd": "prepare", "ok": false, "err": "name"]) }
        queue.async {
            guard let folder = Self.folder() else {
                Task { @MainActor in self.reply(["id": id, "cmd": "prepare", "ok": false, "err": "unavailable"]) }
                return
            }
            let url = folder.appendingPathComponent(name)
            try? FileManager.default.startDownloadingUbiquitousItem(at: url)
            for _ in 0..<120 {
                let status = try? url.resourceValues(forKeys: [.ubiquitousItemDownloadingStatusKey]).ubiquitousItemDownloadingStatus
                if status == .current || (status == nil && FileManager.default.fileExists(atPath: url.path)) {
                    Task { @MainActor in self.reply(["id": id, "cmd": "prepare", "ok": true, "url": "\(LittleDaysWebResources.scheme)://\(LittleDaysWebResources.host)/__icloud/\(name)"]) }
                    return
                }
                Thread.sleep(forTimeInterval: 0.5)
            }
            Task { @MainActor in self.reply(["id": id, "cmd": "prepare", "ok": false, "err": "download"]) }
        }
    }

    /// The bytes of a backup in the container, for the scheme handler.
    nonisolated static func file(named name: String) -> URL? {
        guard validName(name), let folder = folder() else { return nil }
        let url = folder.appendingPathComponent(name)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    func failed(_ name: String, err: String) {
        done(["status": "failed", "err": err, "name": name])
    }

    private func reply(_ object: [String: Any]) {
        send("capidayICloudReply", object)
    }
    private func done(_ object: [String: Any]) {
        send("capidayAutoBackupDone", object)
    }
    private func send(_ function: String, _ object: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: object), let json = String(data: data, encoding: .utf8) else { return }
        webView?.evaluateJavaScript("window.\(function) && window.\(function)(\(json))", completionHandler: nil)
    }
}
