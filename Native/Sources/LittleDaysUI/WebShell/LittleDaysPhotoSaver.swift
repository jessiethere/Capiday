import Photos
import UIKit
import WebKit

/// V10.82 · 把这一页存成图片 → straight into the Photos app.
///
/// Before, the page "downloaded" the PNG and the shell handed every download
/// to the share sheet (`UIActivityViewController`), so 存成图片 opened the same
/// sheet as 分享这一页 — and without `NSPhotoLibraryAddUsageDescription` iOS did
/// not even offer "Save Image" there. Now the page sends the PNG it drew:
/// `{type: "save", id, name, data: <base64 PNG>}` and this saves exactly those
/// bytes as a new photo (PHAssetCreationRequest with the PNG as the photo
/// resource: no re-encoding, no JPEG, same 2160 × 2700). It asks only for
/// "add photos" access (`.addOnly`), never to read the library.
///
/// The page is told `window.capidayPhotoSaved({id, ok, reason, status,
/// detail})` only after iOS has answered: ok is true only when Photos reports
/// the change was saved. reason: "denied" / "restricted" (no access: nothing
/// saved), "data" (not a PNG), "write" (Photos refused; detail = iOS's words),
/// "busy". `{type: "settings"}` opens this app's page in the iOS Settings app.
@MainActor
public final class LittleDaysPhotoSaver: NSObject, WKScriptMessageHandler {
    public static let shared = LittleDaysPhotoSaver()
    static let name = "littleDaysSavePhoto"

    weak var webView: WKWebView?
    private var saving = false

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == Self.name, let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        if type == "settings", let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
            return
        }
        guard type == "save", let id = body["id"] as? String else { return }
        guard !saving else { return reply(id, ok: false, reason: "busy") }
        let name = (body["name"] as? String ?? "Capiday.png").replacingOccurrences(of: "/", with: "-")
        guard let text = body["data"] as? String, let data = Data(base64Encoded: text), data.count > 8,
              data.starts(with: [0x89, 0x50, 0x4E, 0x47]) else { return reply(id, ok: false, reason: "data") }
        saving = true
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            Task { @MainActor in
                guard status == .authorized || status == .limited else {
                    self.saving = false
                    return self.reply(id, ok: false, reason: status == .restricted ? "restricted" : "denied", status: status)
                }
                PHPhotoLibrary.shared().performChanges({
                    let request = PHAssetCreationRequest.forAsset()
                    let options = PHAssetResourceCreationOptions()
                    options.originalFilename = name
                    request.addResource(with: .photo, data: data, options: options)
                }) { success, error in
                    Task { @MainActor in
                        self.saving = false
                        if success {
                            self.reply(id, ok: true, reason: "", status: status, bytes: data.count)
                        } else {
                            self.reply(id, ok: false, reason: "write", status: status, detail: error?.localizedDescription ?? "")
                        }
                    }
                }
            }
        }
    }

    private func reply(_ id: String, ok: Bool, reason: String, status: PHAuthorizationStatus? = nil, detail: String = "", bytes: Int = 0) {
        let state: String
        switch status ?? PHPhotoLibrary.authorizationStatus(for: .addOnly) {
        case .authorized: state = "authorized"
        case .limited: state = "limited"
        case .denied: state = "denied"
        case .restricted: state = "restricted"
        case .notDetermined: state = "notDetermined"
        @unknown default: state = "unknown"
        }
        let payload: [String: Any] = ["id": id, "ok": ok, "reason": reason, "status": state, "detail": detail, "bytes": bytes]
        guard let json = (try? JSONSerialization.data(withJSONObject: payload)).flatMap({ String(data: $0, encoding: .utf8) }) else { return }
        webView?.evaluateJavaScript("window.capidayPhotoSaved && window.capidayPhotoSaved(\(json))", completionHandler: nil)
    }
}
