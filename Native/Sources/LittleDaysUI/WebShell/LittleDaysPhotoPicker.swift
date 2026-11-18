import PhotosUI
import UIKit
import UniformTypeIdentifiers
import WebKit

/// V10.81 · 从相册选择: opens the iPhone's photo library straight away (the
/// system PHPickerViewController) instead of WebKit's file menu ("Photo
/// Library / Take Photo / Choose Files"). The picker runs outside the app,
/// needs no photo-library permission and gives the app only the photos the
/// person picked, in the order they were picked.
///
/// The page sends `{type: "pick", id, limit}` (limit 0 = as many as wanted).
/// Each picked photo is written to a temporary folder in its most compatible
/// form (a HEIC photo comes as JPEG, the same as WebKit's own file input gives)
/// and the page is told `window.capidayPhotosPicked({id, ok, files: [{url,
/// name, type}]})`; it reads every file through
/// `littledays://app/__picked/<name>` and hands them to its own file input,
/// so the import, the photo editor and the saving are exactly the same as
/// before. Cancel = `files: []` (nothing changes). `{type: "done", id}` removes
/// the temporary files (they are also cleared before every new pick).
/// Nothing is uploaded anywhere.
@MainActor
public final class LittleDaysPhotoPicker: NSObject, WKScriptMessageHandler, PHPickerViewControllerDelegate {
    public static let shared = LittleDaysPhotoPicker()
    static let name = "littleDaysPhotos"
    static let route = "/__picked/"

    weak var webView: WKWebView?
    private var pending: String?

    nonisolated static var folder: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("capiday-picked", isDirectory: true)
    }

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == Self.name, let body = message.body as? [String: Any],
              let type = body["type"] as? String, let id = body["id"] as? String else { return }
        if type == "pick" { present(id: id, limit: body["limit"] as? Int ?? 0) }
        if type == "done", pending == nil { Self.clear() }
    }

    private func present(id: String, limit: Int) {
        guard pending == nil, let top = Self.topController(webView) else {
            return reply(id: id, ok: false, error: "busy", files: [])
        }
        Self.clear()
        pending = id
        // No photoLibrary in the configuration: no permission question, and
        // only the picked photos ever reach the app.
        var configuration = PHPickerConfiguration()
        configuration.filter = .images
        configuration.selectionLimit = max(0, limit)
        configuration.preferredAssetRepresentationMode = .compatible
        configuration.selection = .ordered
        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = self
        top.present(picker, animated: true)
    }

    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let id = pending else { return }
        guard !results.isEmpty else {
            pending = nil
            return reply(id: id, ok: true, error: "", files: [])
        }
        let providers = results.map(\.itemProvider)
        Task.detached(priority: .userInitiated) {
            let files = await Self.copy(providers)
            await MainActor.run {
                self.pending = nil
                if files.contains(where: { $0 == nil }) || files.isEmpty {
                    Self.clear()
                    self.reply(id: id, ok: false, error: "read", files: [])
                } else {
                    self.reply(id: id, ok: true, error: "", files: files.compactMap { $0 })
                }
            }
        }
    }

    /// Copies every picked photo into the temporary folder, keeping the order.
    nonisolated private static func copy(_ providers: [NSItemProvider]) async -> [[String: Any]?] {
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var out: [[String: Any]?] = []
        for (index, provider) in providers.enumerated() {
            out.append(await copyOne(provider, index: index))
        }
        return out
    }

    nonisolated private static func copyOne(_ provider: NSItemProvider, index: Int) async -> [String: Any]? {
        // JPEG first (what a HEIC photo becomes in the compatible form), then
        // PNG, then any image the page can read.
        let wanted: [UTType] = [.jpeg, .png, .gif, .webP, .heic, .image]
        guard let type = wanted.first(where: { provider.hasItemConformingToTypeIdentifier($0.identifier) }) else { return nil }
        return await withCheckedContinuation { continuation in
            provider.loadFileRepresentation(forTypeIdentifier: type.identifier) { url, _ in
                guard let url else { return continuation.resume(returning: nil) }
                let ext = url.pathExtension.isEmpty ? (type.preferredFilenameExtension ?? "jpg") : url.pathExtension.lowercased()
                let stored = "\(index)-\(UUID().uuidString.prefix(8)).\(ext)"
                let target = folder.appendingPathComponent(stored)
                do {
                    try FileManager.default.copyItem(at: url, to: target)
                } catch {
                    return continuation.resume(returning: nil)
                }
                let mime = UTType(filenameExtension: ext)?.preferredMIMEType ?? "image/jpeg"
                let base = (provider.suggestedName ?? "photo-\(index + 1)").replacingOccurrences(of: "/", with: "-")
                continuation.resume(returning: [
                    "url": "\(LittleDaysWebResources.scheme)://\(LittleDaysWebResources.host)\(route)\(stored)",
                    "name": "\(base).\(ext)",
                    "type": mime,
                ])
            }
        }
    }

    /// A picked photo's file, for the scheme handler (only our own names).
    nonisolated static func file(named name: String) -> URL? {
        guard !name.isEmpty, name.count < 80, name.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "." }), !name.hasPrefix(".") else { return nil }
        let url = folder.appendingPathComponent(name)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    nonisolated static func clear() {
        try? FileManager.default.removeItem(at: folder)
    }

    private static func topController(_ webView: WKWebView?) -> UIViewController? {
        var top = webView?.window?.rootViewController
        while let next = top?.presentedViewController { top = next }
        return top
    }

    private func reply(id: String, ok: Bool, error: String, files: [[String: Any]]) {
        let payload: [String: Any] = ["id": id, "ok": ok, "error": error, "files": files]
        guard let data = try? JSONSerialization.data(withJSONObject: payload), let json = String(data: data, encoding: .utf8) else { return }
        webView?.evaluateJavaScript("window.capidayPhotosPicked && window.capidayPhotosPicked(\(json))", completionHandler: nil)
    }
}
