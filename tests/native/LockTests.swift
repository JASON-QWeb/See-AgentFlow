import Foundation
import AppKit

private func check(_ condition: Bool, _ message: String) {
    if !condition { fatalError(message) }
}

@main
struct LockTests {
    static func main() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("agent-lock-tests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        try passwords(directory)
        lifecycle(); recovery(); throttling(); try coordinator(directory)
        print("PASS: native password storage, lifecycle, prompt hiding and wake, recovery, throttling and window release")
    }
    static func passwords(_ directory: URL) throws {
        let file = directory.appendingPathComponent("verifier.json")
        let store = try LockPasswordStore(file: file)
        check(!store.isConfigured, "A clean install must not silently create a password")
        do { try store.setPassword(current: "", new: "short"); fatalError("Short password accepted") }
        catch LockPasswordError.length {}
        let first = "temporary-test-\(UUID().uuidString)", second = "next-test-\(UUID().uuidString)"
        try store.setPassword(current: "", new: first)
        check(try store.verify(first), "Correct password rejected")
        check(try !store.verify(second), "Wrong password accepted")
        let bytes = try Data(contentsOf: file)
        check(!String(decoding: bytes, as: UTF8.self).contains(first), "Plaintext password persisted")
        let permissions = try FileManager.default.attributesOfItem(atPath: file.path)[.posixPermissions] as! NSNumber
        check(permissions.intValue & 0o777 == 0o600, "Verifier file is not owner-only")
        let reopened = try LockPasswordStore(file: file)
        check(try reopened.verify(first), "Password did not survive reopening")
        do { try reopened.setPassword(current: second, new: second); fatalError("Changed without old password") }
        catch LockPasswordError.current {}
        try reopened.setPassword(current: first, new: second)
        check(try reopened.verify(second), "New password not active")
        check(try !reopened.verify(first), "Old password still active")
        let original = try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
        var changed = try JSONSerialization.jsonObject(with: Data(contentsOf: file)) as! [String: Any]
        check(original["salt"] as? String != changed["salt"] as? String, "Salt reused")
        changed["iterations"] = 0
        try JSONSerialization.data(withJSONObject: changed).write(to: file)
        do { _ = try LockPasswordStore(file: file); fatalError("Corrupt verifier accepted") }
        catch LockPasswordError.storage {}
    }
    static func lifecycle() {
        for unlockBeforeStop in [false, true] {
            var state = LockState()
            state.saverStarted(arm: true); state.systemLock(true)
            check(state.locked && !state.shouldPresent, "App must yield to system authentication")
            if unlockBeforeStop { state.systemLock(false); state.saverStopped() }
            else { state.saverStopped(); check(!state.shouldPresent, "Presented before system unlock"); state.systemLock(false) }
            check(state.shouldPresent, "Screen saver did not return to app lock")
            let attempt = state.generation
            state.sleep(true); check(!state.shouldPresent && state.generation != attempt, "Sleep kept stale verification")
            state.sleep(false); check(state.shouldPresent, "Wake lost lock")
            state.unlock(); check(!state.locked && !state.shouldPresent, "Unlock did not release all-screen state")
        }
        var disabled = LockState(); disabled.saverStarted(arm: false); disabled.saverStopped()
        check(!disabled.locked, "Unconfigured or disabled auto-lock should remain inactive")
        disabled.begin(); let generation = disabled.generation
        disabled.saverStarted(arm: true)
        check(disabled.generation != generation, "Old authentication can release a new screen-saver lock")
    }
    static func recovery() {
        var state = LockState(); state.begin()
        for tap in 0..<9 { check(!state.titleTap(now: 10 + Double(tap) * 0.2), "Recovery opened before ten taps") }
        check(state.titleTap(now: 11.8), "Tenth title tap did not recover")
        state.unlock(); check(!state.titleTap(now: 12), "Recovery ran while already unlocked")
        state.begin()
        for tap in 0..<9 { check(!state.titleTap(now: 20 + Double(tap) * 0.2), "Early recovery") }
        check(!state.titleTap(now: 30), "Old sequence survived a pause")
    }
    static func throttling() {
        var state = LockState(); state.begin()
        for _ in 0..<5 { state.failed(now: 100) }
        check(!state.canAttempt(now: 101), "Unlimited repeated guesses")
        check(state.canAttempt(now: 106), "Retry cooldown never ended")
    }
    static func coordinator(_ directory: URL) throws {
        let app = NSApplication.shared; app.setActivationPolicy(.prohibited)
        let presentation = app.presentationOptions
        let name = "agent-lock-coordinator-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        defer { defaults.removePersistentDomain(forName: name) }
        let preferences = DesktopPreferences(defaults: defaults, file: directory.appendingPathComponent("none.json"))
        check(preferences.lockAfterSaver, "Auto-lock must default to enabled")
        let vault = try LockPasswordStore(file: directory.appendingPathComponent("controller.json"))
        let coordinator = AppLockCoordinator(preferences: preferences, vault: vault, presentsWindows: false)
        defer { coordinator.dispose() }
        check(!coordinator.enter(), "Locking without a configured password")
        let password = "controller-test-\(UUID().uuidString)"
        try vault.setPassword(current: "", new: password)
        let configured = AppLockCoordinator(preferences: preferences, vault: vault, presentsWindows: false)
        defer { configured.dispose() }
        check(configured.enter(), "Configured fullscreen refused")
        check(configured.coveredFrames == NSScreen.screens.map(\.frame), "Not all physical displays covered")
        check(app.presentationOptions == presentation, "Background tests changed presentation options")
        configured.submitPassword("wrong-password")
        RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        check(configured.isLocked, "Wrong password exited fullscreen")
        configured.submitPassword(password)
        let deadline = Date().addingTimeInterval(3)
        while configured.isLocked && Date() < deadline { RunLoop.current.run(until: Date().addingTimeInterval(0.01)) }
        check(!configured.isLocked && configured.coveredFrames.isEmpty, "Correct password did not release every window")
        configured.enter(original: true)
        let frame = NSRect(x: 0, y: 0, width: 800, height: 600)
        let container = NSView(frame: frame)
        let prompt = LockPromptView(frame: frame, preferences: preferences)
        container.addSubview(prompt)
        prompt.layoutSubtreeIfNeeded()
        prompt.onTitleTap = { configured.registerTitleTap() }
        func click(_ point: NSPoint) {
            let event = NSEvent.mouseEvent(with: .leftMouseDown, location: point, modifierFlags: [],
                timestamp: 0, windowNumber: 0, context: nil, eventNumber: 0, clickCount: 1, pressure: 1)!
            prompt.hitTest(point)?.mouseDown(with: event)
        }
        for _ in 0..<10 { click(NSPoint(x: 250, y: 277)) }
        check(configured.isLocked, "Password border still triggers recovery")
        for _ in 0..<9 { click(NSPoint(x: 250, y: 390)) }
        check(configured.isLocked, "Recovery released early")
        click(NSPoint(x: 250, y: 390))
        check(!configured.isLocked && configured.coveredFrames.isEmpty, "Title recovery failed to release every window")
        check(app.presentationOptions == presentation, "Recovery modified desktop state")
        try promptVisibility(preferences, vault)
    }
    static func promptVisibility(_ preferences: DesktopPreferences, _ vault: LockPasswordStore) throws {
        guard !NSScreen.screens.isEmpty else { return }
        let coordinator = AppLockCoordinator(preferences: preferences, vault: vault, presentsWindows: false, promptTimeout: 0.3)
        defer { coordinator.dispose() }
        check(coordinator.enter(), "Could not prepare prompt test")
        let windows = NSApp.windows.compactMap { $0 as? LockedWindow }.filter { $0.contentView != nil }
        let prompts = windows.compactMap { $0.contentView?.subviews.compactMap { $0 as? LockPromptView }.first }
        check(prompts.count == NSScreen.screens.count, "Missing password prompt")
        let window = windows[0], prompt = prompts[0]
        let card = prompt.subviews[0]
        let close = card.subviews.compactMap { $0 as? NSButton }.first { $0.title == "×" }!
        let field = card.subviews.flatMap(\.subviews).compactMap { $0 as? NSSecureTextField }.first!
        field.stringValue = "partial"
        close.performClick(nil)
        check(prompts.allSatisfy(\.isHidden) && field.stringValue.isEmpty, "Close did not hide all prompts and clear input")
        check(coordinator.isLocked && coordinator.coveredFrames.count == windows.count, "Closing the prompt exposed the desktop")
        let click = NSEvent.mouseEvent(with: .leftMouseDown, location: .zero, modifierFlags: [], timestamp: 0,
            windowNumber: window.windowNumber, context: nil, eventNumber: 0, clickCount: 1, pressure: 1)!
        window.sendEvent(click)
        check(prompts.allSatisfy { !$0.isHidden }, "Click did not restore all prompts")
        RunLoop.current.run(until: Date().addingTimeInterval(0.18))
        field.stringValue = "partial again"
        prompt.controlTextDidChange(Notification(name: NSControl.textDidChangeNotification, object: field))
        RunLoop.current.run(until: Date().addingTimeInterval(0.17))
        check(!prompt.isHidden, "Password edit did not restart the timer")
        RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        check(prompts.allSatisfy(\.isHidden) && field.stringValue.isEmpty && coordinator.isLocked, "Idle prompt did not clear and hide")
        let enter = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [], timestamp: 0,
            windowNumber: window.windowNumber, context: nil, characters: "\r", charactersIgnoringModifiers: "\r",
            isARepeat: false, keyCode: 36)!
        window.sendEvent(enter)
        check(prompts.allSatisfy { !$0.isHidden }, "Return did not restore all prompts")
    }
}
