import XCTest

/// UI tests run with `-ui-testing`, which swaps in an in-memory key store, secrets and
/// notification scheduler (DEBUG builds only), so no Keychain or permission prompts appear.
/// UNVERIFIED: not run in this environment (no Xcode/simulator). Expected to need minor
/// selector adjustments on first run.
final class LittleThingsUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-ui-testing"]
        app.launch()
    }

    func createVault() {
        let create = app.buttons["createVaultButton"]
        XCTAssertTrue(create.waitForExistence(timeout: 5))
        create.tap()
    }

    func addPerson(_ name: String) {
        app.buttons["addPersonManuallyButton"].firstMatch.tap()
        let field = app.textFields["personNameField"]
        XCTAssertTrue(field.waitForExistence(timeout: 3))
        field.tap()
        field.typeText(name)
        app.buttons["savePersonButton"].tap()
    }

    func testOnboardingWithoutPermissions() {
        createVault()
        XCTAssertTrue(app.buttons["chooseContactsButton"].waitForExistence(timeout: 5))
        addPerson("Sam Rivera")
        XCTAssertTrue(app.staticTexts["Nothing needs you today"].waitForExistence(timeout: 5))
    }

    func testAddPersonDateAndPromiseShowsCard() {
        createVault()
        addPerson("Alex Morgan")
        app.buttons["addMenu"].firstMatch.tap()
        app.buttons["Promise"].tap()
        app.buttons["personPicker"].firstMatch.tap()
        app.buttons["Alex Morgan"].firstMatch.tap()
        let text = app.textFields["promiseText"]
        text.tap()
        text.typeText("Send the photographer's number")
        app.switches["Due date"].tap()
        app.buttons["savePromiseButton"].tap()
        XCTAssertTrue(app.otherElements["card-promise.due"].waitForExistence(timeout: 5))
    }

    func testReviewDraftThenCancelLogsNothing() {
        createVault()
        addPerson("Maya Chen")
        app.buttons["addMenu"].firstMatch.tap()
        app.buttons["Date"].tap()
        app.buttons["personPicker"].firstMatch.tap()
        app.buttons["Maya Chen"].firstMatch.tap()
        app.buttons["saveDateButton"].tap()
        let draft = app.buttons["cardAction-draftMessage"].firstMatch
        XCTAssertTrue(draft.waitForExistence(timeout: 5))
        draft.tap()
        XCTAssertTrue(app.textViews["draftText"].waitForExistence(timeout: 3))
        app.buttons["cancelDraft"].tap()
        XCTAssertTrue(app.otherElements["card-date.upcoming"].exists)
    }

    func testPausePersonRemovesCards() {
        createVault()
        addPerson("Jeff Park")
        app.tabBars.buttons["People"].tap()
        app.staticTexts["Jeff Park"].tap()
        let pause = app.switches["pauseToggle"]
        XCTAssertTrue(pause.waitForExistence(timeout: 3))
        pause.tap()
        app.tabBars.buttons["Today"].tap()
        XCTAssertFalse(app.otherElements["card-cadence.baseline"].exists)
    }

    func testDemoIsLabelledAndExits() {
        app.buttons["startDemoButton"].tap()
        XCTAssertTrue(app.otherElements["demoBanner"].waitForExistence(timeout: 5))
        app.buttons["Exit demo"].tap()
        XCTAssertTrue(app.buttons["createVaultButton"].waitForExistence(timeout: 5))
    }

    func testBackupStartsWithRecoveryKey() {
        createVault()
        addPerson("Rachel Adams")
        app.tabBars.buttons["Settings"].tap()
        let backup = app.buttons["backupLink"].firstMatch
        XCTAssertTrue(backup.waitForExistence(timeout: 3))
        backup.tap()
        let create = app.buttons["createBackupButton"]
        XCTAssertTrue(create.waitForExistence(timeout: 3))
        create.tap()
        XCTAssertTrue(app.staticTexts["recoveryKeyText"].waitForExistence(timeout: 3))
    }

    func testDeleteEverythingReturnsToOnboarding() {
        createVault()
        addPerson("Chris Lee")
        app.tabBars.buttons["Settings"].tap()
        app.swipeUp()
        app.buttons["deleteEverythingButton"].tap()
        app.buttons["confirmDeleteEverything"].firstMatch.tap()
        XCTAssertTrue(app.buttons["createVaultButton"].waitForExistence(timeout: 5))
    }
}
