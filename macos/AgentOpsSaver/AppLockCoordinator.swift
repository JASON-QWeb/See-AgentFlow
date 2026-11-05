import AppKit
import WebKit

final class LockedWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

final class AppLockCoordinator: NSObject, NSWindowDelegate {
    private let preferences: DesktopPreferences
    private let vault: LockPasswordStore?
    private let presentsWindows: Bool
    private let cryptoQueue = DispatchQueue(label: "local.agentops.password", qos: .userInitiated)
    private(set) var state = LockState()
    private var configured = false
    private var windows: [NSWindow] = []
    private var renderers: [SaverWebView] = []
    private var prompts: [LockPromptView] = []
    private var savedPresentation: NSApplication.PresentationOptions?
    private var notifications: [(NotificationCenter, NSObjectProtocol)] = []
    private var passwordSheet: PasswordSettingsSheet?
    private var busy = false
    private var originalLayout = false
    private(set) var systemEnding = false
    var onLockedChanged: ((Bool) -> Void)?
    var onNeedsPassword: (() -> Void)?
    var onUnlocked: (() -> Void)?
    var isLocked: Bool { state.locked }
    var coveredFrames: [NSRect] { windows.map(\.frame) }

    init(preferences: DesktopPreferences, vault: LockPasswordStore? = try? LockPasswordStore(), presentsWindows: Bool = true) {
        self.preferences = preferences; self.vault = vault; configured = vault?.isConfigured ?? false
        self.presentsWindows = presentsWindows
        super.init(); observeLifecycle()
    }
    var status: [String: Any] {
        ["available": true, "configured": configured, "afterSaver": preferences.lockAfterSaver,
         "locked": state.locked, "storageAvailable": vault != nil]
    }
    @discardableResult func enter(original: Bool = false) -> Bool {
        if state.locked { refresh(); focusDisplay(0); return true }
        guard configured, passwordSheet == nil else { onNeedsPassword?(); return false }
        originalLayout = original; state.begin(); onLockedChanged?(true); refresh(); return true
    }
    func presentPasswordSettings(on parent: NSWindow, completion: @escaping () -> Void) {
        guard !state.locked, passwordSheet == nil, let vault else { completion(); return }
        preferences.reloadLanguage()
        let sheet = PasswordSettingsSheet(preferences: preferences, configured: configured)
        passwordSheet = sheet
        sheet.onSave = { [weak self] old, new, done in
            guard let self else { return }
            self.cryptoQueue.async {
                let failure: String?
                do { try vault.setPassword(current: old, new: new); failure = nil }
                catch { failure = (error as? LockPasswordError)?.rawValue ?? LockPasswordError.storage.rawValue }
                DispatchQueue.main.async {
                    if failure == nil { self.configured = true }
                    done(failure)
                }
            }
        }
        sheet.onFinish = { [weak self] _ in self?.passwordSheet = nil; completion() }
        sheet.present(on: parent)
    }
    func setAfterSaver(_ enabled: Bool) { if !state.locked { preferences.lockAfterSaver = enabled } }
    func focusDisplay(_ index: Int) {
        guard presentsWindows, windows.indices.contains(index) else { return }
        windows[index].makeKeyAndOrderFront(nil); prompts[index].focus()
    }

    private func observe(_ center: NotificationCenter, _ name: Notification.Name, _ block: @escaping (AppLockCoordinator) -> Void) {
        notifications.append((center, center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
            guard let self else { return }; block(self)
        }))
    }
    private func observeLifecycle() {
        let distributed = DistributedNotificationCenter.default(), workspace = NSWorkspace.shared.notificationCenter
        observe(distributed, .init("com.apple.screensaver.didstart")) { owner in
            owner.passwordSheet?.dismiss()
            owner.state.saverStarted(arm: owner.configured && owner.preferences.lockAfterSaver)
            owner.onLockedChanged?(owner.state.locked); owner.refresh()
        }
        for name in ["com.apple.screensaver.willstop", "com.apple.screensaver.didstop"] {
            observe(distributed, .init(name)) { $0.state.saverStopped(); $0.refresh() }
        }
        observe(distributed, .init("com.apple.screenIsLocked")) { $0.passwordSheet?.dismiss(); $0.state.systemLock(true); $0.refresh() }
        observe(distributed, .init("com.apple.screenIsUnlocked")) { $0.state.systemLock(false); $0.refresh() }
        observe(workspace, NSWorkspace.screensDidSleepNotification) { $0.state.sleep(true); $0.refresh() }
        observe(workspace, NSWorkspace.screensDidWakeNotification) { $0.state.sleep(false); $0.refresh() }
        observe(workspace, NSWorkspace.willPowerOffNotification) { $0.systemEnding = true; $0.releaseWindows() }
        observe(.default, NSApplication.didChangeScreenParametersNotification) { owner in
            if owner.state.shouldPresent { owner.releaseWindows(); owner.refresh() }
        }
    }

    private func refresh() {
        guard state.shouldPresent else { busy = false; releaseWindows(); return }
        if windows.isEmpty { buildWindows() }
    }
    private func buildWindows() {
        preferences.reloadLanguage()
        // Offscreen native tests exercise real windows without touching the user's displays.
        if presentsWindows {
            savedPresentation = NSApp.presentationOptions
            NSApp.presentationOptions = [.hideDock, .hideMenuBar, .disableProcessSwitching, .disableHideApplication]
        }
        for screen in NSScreen.screens {
            let window = LockedWindow(contentRect: screen.frame, styleMask: [.borderless], backing: .buffered, defer: false)
            window.setFrame(screen.frame, display: false); window.backgroundColor = .black
            window.isOpaque = true; window.isReleasedWhenClosed = false; window.level = .screenSaver
            window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
            window.title = "Agent Ops · Locked · \(screen.localizedName)"; window.delegate = self
            let container = NSView(frame: NSRect(origin: .zero, size: screen.frame.size)); window.contentView = container
            renderers.append(SaverWebView(container: container, layout: DisplayLayout.make(screen: screen, preview: originalLayout)))
            let prompt = LockPromptView(frame: container.bounds, preferences: preferences)
            prompt.setBusy(busy)
            prompt.onSubmit = { [weak self] password in self?.submitPassword(password) }
            prompt.onBorderTap = { [weak self] in self?.registerBorderTap() }
            container.addSubview(prompt); prompts.append(prompt); windows.append(window)
            if presentsWindows { window.orderFrontRegardless() }
        }
        if presentsWindows {
            NSApp.activate(ignoringOtherApps: true)
            windows.first?.makeKeyAndOrderFront(nil); prompts.first?.focus()
        }
    }
    func registerBorderTap() {
        if state.borderTap(now: ProcessInfo.processInfo.systemUptime) { unlock() }
    }
    func submitPassword(_ password: String) {
        guard let vault, !busy, state.shouldPresent else { return }
        guard state.canAttempt(now: ProcessInfo.processInfo.systemUptime) else {
            prompts.forEach { $0.setBusy(false, error: "Too many attempts. Try again shortly.") }; return
        }
        busy = true; prompts.forEach { $0.setBusy(true) }
        let generation = state.generation
        cryptoQueue.async { [weak self] in
            let matches = (try? vault.verify(password)) ?? false
            DispatchQueue.main.async {
                guard let self, self.state.locked, self.state.generation == generation else { return }
                self.busy = false
                if matches { self.unlock() }
                else {
                    self.state.failed(now: ProcessInfo.processInfo.systemUptime)
                    self.prompts.forEach { $0.setBusy(false, error: "Incorrect password.") }
                }
            }
        }
    }
    private func unlock() {
        state.unlock(); busy = false; releaseWindows(); onLockedChanged?(false); onUnlocked?()
    }
    private func releaseWindows() {
        renderers.forEach { $0.dispose() }; renderers.removeAll(); prompts.removeAll()
        windows.forEach { $0.delegate = nil; $0.contentView = nil; $0.close() }; windows.removeAll()
        if let savedPresentation { NSApp.presentationOptions = savedPresentation; self.savedPresentation = nil }
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool { !state.locked }
    func dispose() {
        releaseWindows(); notifications.forEach { $0.0.removeObserver($0.1) }; notifications.removeAll()
    }
    deinit { notifications.forEach { $0.0.removeObserver($0.1) } }
}

final class DesktopLockBridge: NSObject, WKScriptMessageHandlerWithReply {
    private weak var coordinator: AppLockCoordinator?
    init(_ coordinator: AppLockCoordinator) { self.coordinator = coordinator }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url,
              url.scheme == "http", url.host == "127.0.0.1", url.port == 4318, url.path == "/",
              let body = message.body as? [String: Any], let action = body["action"] as? String,
              let coordinator else { replyHandler(nil, "Desktop access only"); return }
        if action == "status" { replyHandler(coordinator.status, nil); return }
        guard !coordinator.isLocked else { replyHandler(nil, "Unlock first"); return }
        switch action {
        case "fullscreen":
            let ready = coordinator.status["configured"] as? Bool == true
            replyHandler(["needsPassword": !ready], nil)
            if ready { DispatchQueue.main.async { coordinator.enter() } }
        case "configure":
            guard let window = message.webView?.window else { replyHandler(nil, "Window unavailable"); return }
            coordinator.presentPasswordSettings(on: window) { replyHandler(coordinator.status, nil) }
        case "afterSaver":
            guard let enabled = body["enabled"] as? Bool else { replyHandler(nil, "Invalid preference"); return }
            coordinator.setAfterSaver(enabled); replyHandler(coordinator.status, nil)
        default: replyHandler(nil, "Unknown action")
        }
    }
}
