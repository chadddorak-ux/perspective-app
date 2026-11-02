import XCTest

/// Walks through the real app in the simulator and saves screenshots of the main screens.
/// Uses only the synthetic demo data and the `-ui-testing` in-memory environment.
/// Screenshots are written to `$SIMULATOR_HOST_HOME/littlethings-screens` (the Mac host's home
/// folder) and attached to the test result.
final class ScreenshotTour: XCTestCase {
    var app: XCUIApplication!

    override func setUp() {
        // Keep going after a missed step so the rest of the tour is still captured.
        continueAfterFailure = true
        app = XCUIApplication()
        app.launchArguments = ["-ui-testing"]
        app.launch()
    }

    func snap(_ name: String) {
        sleep(1) // let animations settle
        let shot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: shot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let home = ProcessInfo.processInfo.environment["SIMULATOR_HOST_HOME"] {
            let dir = URL(fileURLWithPath: home).appendingPathComponent("littlethings-screens")
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try? shot.pngRepresentation.write(to: dir.appendingPathComponent("\(name).png"))
        }
    }

    @discardableResult
    func tap(_ element: XCUIElement, timeout: TimeInterval = 4) -> Bool {
        guard element.waitForExistence(timeout: timeout) else { return false }
        element.tap()
        return true
    }

    func back() {
        let button = app.navigationBars.buttons.element(boundBy: 0)
        if button.exists { button.tap() }
    }

    func scrollTo(_ element: XCUIElement, maxSwipes: Int = 6) -> XCUIElement {
        var swipes = 0
        while !element.exists && swipes < maxSwipes {
            app.swipeUp()
            swipes += 1
        }
        return element
    }

    /// Demo walkthrough: Today, explanations, drafts, people, capture and review, upcoming, settings.
    func testDemoTour() {
        snap("01-welcome")

        XCTAssertTrue(tap(app.buttons["startDemoButton"]))
        XCTAssertTrue(app.otherElements["demoBanner"].waitForExistence(timeout: 6))
        snap("02-today")

        if tap(app.buttons["Why this appeared"].firstMatch) {
            snap("03-why-this-appeared")
            tap(app.buttons["Done"].firstMatch)
        }

        let lifeCard = app.otherElements["card-life.update"]
        if tap(lifeCard.buttons["cardAction-draftMessage"].firstMatch) || tap(app.buttons["cardAction-draftMessage"].firstMatch) {
            _ = app.textViews["draftText"].waitForExistence(timeout: 4)
            snap("04-draft")
            tap(app.buttons["cancelDraft"])
        }

        if tap(app.buttons["moreUpcoming"].firstMatch, timeout: 2) || tap(app.staticTexts["More upcoming (3)"].firstMatch, timeout: 2) {
            app.swipeUp()
            snap("05-more-upcoming")
            app.swipeDown()
        }

        tap(app.tabBars.buttons["People"])
        snap("06-people")

        if tap(app.staticTexts["Alex Morgan (Demo)"].firstMatch) {
            snap("07-person")
            app.swipeUp()
            snap("08-person-details")
            back()
        }

        tap(app.tabBars.buttons["Today"])
        if tap(app.buttons["addMenu"].firstMatch), tap(app.buttons["Memory"].firstMatch) {
            tap(app.buttons["Alex Morgan (Demo)"].firstMatch)
            let field = app.textFields["memoryText"].exists ? app.textFields["memoryText"] : app.textViews["memoryText"]
            if tap(field) {
                field.typeText("Alex's daughter is Maya. Her recital is December 12. I promised to send him the photographer's number.")
            }
            snap("09-add-memory")
            if tap(app.buttons["saveMemoryButton"]) {
                _ = app.buttons["saveSelectedButton"].waitForExistence(timeout: 6)
                snap("10-review-suggestions")
                app.swipeUp()
                snap("11-review-suggestions-more")
                tap(app.buttons["saveSelectedButton"])
            }
        }

        tap(app.tabBars.buttons["Upcoming"])
        snap("12-upcoming")
        if tap(app.buttons["Calendar"].firstMatch) {
            snap("13-upcoming-calendar")
            tap(app.buttons["List"].firstMatch)
        }

        tap(app.tabBars.buttons["Settings"])
        snap("14-settings")
        if tap(app.buttons["What can LittleThings see?"].firstMatch) {
            snap("15-sources")
            app.swipeUp()
            app.swipeUp()
            snap("16-sources-more")
            back()
        }
    }

    /// Real (non-demo) vault screens: backup recovery key and the lock screen.
    func testVaultTour() {
        XCTAssertTrue(tap(app.buttons["createVaultButton"], timeout: 6))
        snap("17-empty-today")
        if tap(app.buttons["addPersonManuallyButton"].firstMatch) {
            let name = app.textFields["personNameField"]
            if tap(name) { name.typeText("Rachel Adams") }
            snap("18-add-person")
            tap(app.buttons["savePersonButton"])
        }
        tap(app.tabBars.buttons["Settings"])
        if tap(scrollTo(app.buttons["backupLink"].firstMatch)), tap(app.buttons["createBackupButton"]) {
            _ = app.staticTexts["recoveryKeyText"].waitForExistence(timeout: 4)
            snap("19-recovery-key")
            back()
        }
        app.swipeDown()
        app.swipeDown()
        if tap(app.buttons["Lock now"].firstMatch) {
            _ = app.buttons["unlockButton"].waitForExistence(timeout: 4)
            snap("20-locked")
        }
    }
}
