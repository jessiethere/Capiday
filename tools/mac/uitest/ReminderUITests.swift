import XCTest

// V10.80 · Daily reminder on the Debug build in the iOS Simulator (real
// system alert and a real notification banner). Runs only in a temporary copy
// of the project (see tools/mac/uitest/README.md); the repository's Xcode
// project is not changed. The scenario runs inside the app
// (reminder-check.js via -LittleDaysCheck); this test only does what a person
// does outside the page: taps "Allow" on the notification question, goes to
// the Home Screen, waits for the reminder and taps it. Synthetic data only.
final class ReminderUITests: XCTestCase {
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
        try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "/tmp/ld-uitest/shots/reminder-\(name).png"))
    }
    func launch() {
        app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN", "-LittleDaysCheck", "/tmp/ld-uitest/reminder-check.js"]
        app.launch()
    }

    func testDailyReminder() throws {
        try? FileManager.default.createDirectory(atPath: "/tmp/ld-uitest/shots", withIntermediateDirectories: true)
        launch() // fresh install: the check signs in locally and stops ("seeded")
        Thread.sleep(forTimeInterval: 6)
        app.terminate()
        launch()
        XCTAssertTrue(waitPhase("asking", 120), "the reminder sheet was confirmed")
        // iOS asks once whether Capiday may send notifications.
        let allow = springboard.buttons.matching(NSPredicate(format: "label IN {'允许', 'Allow'}")).firstMatch
        if allow.waitForExistence(timeout: 20) {
            shot("1-ask")
            allow.tap()
            print("LDSTEP allowed notifications")
        } else { print("LDSTEP no notification question (already answered)") }
        XCTAssertTrue(waitPhase("wait-notification", 60), "draft step done")
        shot("2-before-home")
        XCUIDevice.shared.press(.home)
        // The reminder fires about two minutes after it was set.
        let banner = springboard.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS '今天有什么想留下的'")).firstMatch
        if banner.waitForExistence(timeout: 240) {
            shot("3-banner")
            print("LDSTEP banner: \(banner.label)")
            banner.tap()
        } else {
            shot("3-no-banner")
            XCTFail("no reminder banner within 4 minutes")
            return
        }
        XCTAssertTrue(waitPhase("done", 120), "scenario finished")
        shot("4-done")
        print("LDSTEP state: \(state())")
    }
}
