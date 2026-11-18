import XCTest

// V10.81 · 添加照片 (the real photo library picker), 配文 and the 编辑图片 top bar
// on the Debug build in the iOS Simulator. Runs only in a temporary copy of
// the project (see tools/mac/uitest/README.md; copy this file to the name the
// target script expects). The scenario runs inside the app (photo-check.js via
// -LittleDaysCheck); this test only does what a person does in the system's
// own picker: picks two photos and taps 添加, later taps 取消. It also takes the
// screenshots. Synthetic data only (the Simulator's sample photos).
final class PhotoUITests: XCTestCase {
    var app: XCUIApplication!

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
        try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "/tmp/ld-uitest/shots/photo-\(name).png"))
    }
    func launch() {
        app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN", "-LittleDaysCheck", "/tmp/ld-uitest/photo-check.js"]
        app.launch()
    }
    /// The system photo picker's photos (they are shown inside the app's window).
    func pickerPhotos() -> XCUIElementQuery {
        app.descendants(matching: .image).matching(NSPredicate(format: "label BEGINSWITH '照片' OR label BEGINSWITH 'Photo' OR identifier BEGINSWITH 'PXGGridLayout'"))
    }
    func pickerButton(_ labels: [String]) -> XCUIElement {
        app.descendants(matching: .button).matching(NSPredicate(format: "label IN %@", labels)).firstMatch
    }

    func testAddPhotosCaptionAndEditorTopBar() throws {
        try? FileManager.default.createDirectory(atPath: "/tmp/ld-uitest/shots", withIntermediateDirectories: true)
        launch() // fresh install: the check signs in locally and stops ("seeded")
        Thread.sleep(forTimeInterval: 6)
        app.terminate()
        launch()
        XCTAssertTrue(waitPhase("library", 120), "从相册选择 was tapped")
        // The system photo library opens straight away (no Photo Library / Take Photo / Choose Files menu).
        let menu = app.descendants(matching: .any).matching(NSPredicate(format: "label IN {'Take Photo', 'Choose Files', '拍照', '选取文件'}")).firstMatch
        let photos = pickerPhotos()
        XCTAssertTrue(photos.firstMatch.waitForExistence(timeout: 20), "the photo library picker is open")
        print("LDSTEP picker open; file menu shown: \(menu.exists)")
        shot("1-library")
        photos.element(boundBy: 0).tap()
        photos.element(boundBy: 1).tap()
        shot("2-picked-two")
        let add = pickerButton(["添加", "Add"])
        XCTAssertTrue(add.waitForExistence(timeout: 5), "添加 in the picker")
        add.tap()
        XCTAssertTrue(waitPhase("editor", 90), "the photo editor opened with the photos")
        shot("3-editor")
        XCTAssertTrue(waitPhase("caption", 90), "配文 typed")
        shot("4-caption")
        XCTAssertTrue(waitPhase("library-cancel", 90), "从相册选择 again")
        XCTAssertTrue(photos.firstMatch.waitForExistence(timeout: 20), "the photo library picker is open again")
        let cancel = pickerButton(["取消", "Cancel"])
        XCTAssertTrue(cancel.waitForExistence(timeout: 5), "取消 in the picker")
        cancel.tap()
        XCTAssertTrue(waitPhase("done", 120), "scenario finished")
        shot("5-done")
        for step in state()["steps"] as? [[String: Any]] ?? [] {
            if let data = try? JSONSerialization.data(withJSONObject: step), let line = String(data: data, encoding: .utf8) { print("LDRESULT \(line)") }
        }
    }
}
