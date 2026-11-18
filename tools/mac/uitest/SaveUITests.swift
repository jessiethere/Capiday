import XCTest

// V10.82 · 把这一页存成图片 → the Photos app, on the Debug build in the iOS
// Simulator. The scenario runs inside the app (save-check.js via
// -LittleDaysCheck, one copy per mode: save-seed / save-page / save-deny /
// save-allow .js in /tmp/ld-uitest); this test does what only a person can:
// answers the real iOS "add to Photos" question (不允许, then — after the
// permission is reset, standing in for turning it on in Settings — 允许),
// and looks at the screen for a share sheet. Afterwards the run script looks
// in the Simulator's own photo library for the saved files. Synthetic data only.
final class SaveUITests: XCTestCase {
    var app: XCUIApplication!
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")

    func state() -> [String: Any] {
        let el = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH 'LDSTATE:'")).firstMatch
        guard el.exists else { return [:] }
        return (try? JSONSerialization.jsonObject(with: Data(String(el.label.dropFirst(8)).utf8))) as? [String: Any] ?? [:]
    }
    func phase() -> String { state()["phase"] as? String ?? "" }
    func waitPhase(_ name: String, _ seconds: Double) -> Bool {
        let end = Date().addingTimeInterval(seconds)
        while Date() < end { if phase() == name { return true }; Thread.sleep(forTimeInterval: 0.5) }
        return false
    }
    func shot(_ name: String) {
        try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "/tmp/ld-uitest/shots/save-\(name).png"))
    }
    func launch(_ mode: String) {
        app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN", "-LittleDaysCheck", "/tmp/ld-uitest/save-\(mode).js"]
        app.launch()
    }
    /// The system share sheet (its list or its usual buttons) on screen.
    func shareSheetShown(_ seconds: Double) -> Bool {
        let sheet = app.descendants(matching: .any).matching(NSPredicate(format: "identifier == 'ActivityListView' OR label IN {'拷贝', 'Copy', 'AirDrop', '隔空投送', '存储图像', 'Save Image', '编辑操作…', 'Edit Actions…'}")).firstMatch
        return sheet.waitForExistence(timeout: seconds)
    }
    /// A button of the iOS permission question.
    func answer(_ labels: [String]) -> String {
        let button = springboard.buttons.matching(NSPredicate(format: "label IN %@", labels)).firstMatch
        guard button.waitForExistence(timeout: 25) else { return "" }
        let alert = springboard.alerts.firstMatch.exists ? springboard.alerts.firstMatch.label : ""
        button.tap()
        return alert.isEmpty ? button.label : alert
    }
    func results() {
        for step in state()["steps"] as? [[String: Any]] ?? [] {
            if let data = try? JSONSerialization.data(withJSONObject: step), let line = String(data: data, encoding: .utf8) { print("LDRESULT \(line)") }
        }
    }

    func testSaveToPhotos() throws {
        try? FileManager.default.createDirectory(atPath: "/tmp/ld-uitest/shots", withIntermediateDirectories: true)
        app = XCUIApplication()
        app.resetAuthorizationStatus(for: .photos) // start from "never asked"
        launch("seed")
        _ = waitPhase("done", 40)
        app.terminate()
        launch("page")
        XCTAssertTrue(waitPhase("done", 90), "the test page was added")
        app.terminate()

        // 1. First 存成图片: iOS asks; 不允许.
        launch("deny")
        XCTAssertTrue(waitPhase("save-denied", 120), "存成图片 tapped")
        Thread.sleep(forTimeInterval: 1)
        shot("1-question")
        let asked = answer(["不允许", "Don’t Allow", "Don't Allow"])
        print("LDSTEP question: \(asked)")
        XCTAssertFalse(asked.isEmpty, "iOS asked about adding to Photos")
        XCTAssertTrue(waitPhase("save-denied-answered", 60), "the page heard iOS's answer")
        shot("2-denied")
        print("LDSTEP after 不允许, share sheet shown: \(shareSheetShown(2))")
        // 2. 分享这一页: the share sheet.
        XCTAssertTrue(waitPhase("share", 60), "分享这一页 tapped")
        let sheet = shareSheetShown(10)
        shot("3-share")
        print("LDSTEP 分享这一页, share sheet shown: \(sheet)")
        XCTAssertTrue(sheet, "分享这一页 opens the share sheet")
        let close = app.buttons.matching(NSPredicate(format: "label IN {'关闭', 'Close'}")).firstMatch
        if close.waitForExistence(timeout: 3) { close.tap() } else { app.swipeDown() }
        XCTAssertTrue(waitPhase("done", 90), "deny scenario finished")
        results()
        app.terminate()

        // 3. Allowed (the permission reset stands in for turning it on in Settings): 允许.
        app.resetAuthorizationStatus(for: .photos)
        launch("allow")
        XCTAssertTrue(waitPhase("save-allowed", 120), "存成图片 tapped again")
        Thread.sleep(forTimeInterval: 1)
        let allowed = answer(["允许", "Allow", "允许添加照片", "Allow Adding Photos"])
        print("LDSTEP question: \(allowed)")
        XCTAssertTrue(waitPhase("save-allowed-answered", 60), "saved after 允许")
        shot("4-saved")
        let sheetAfterSave = shareSheetShown(2)
        print("LDSTEP after 允许, share sheet shown: \(sheetAfterSave)")
        XCTAssertFalse(sheetAfterSave, "存成图片 does not open the share sheet")
        XCTAssertTrue(waitPhase("save-again-answered", 60), "a second save, no question")
        shot("5-saved-again")
        XCTAssertFalse(shareSheetShown(2), "still no share sheet")
        XCTAssertTrue(waitPhase("done", 60), "allow scenario finished")
        results()
    }
}
