import AppKit

final class PreviewDelegate: NSObject, NSApplicationDelegate {
    private var inputMonitor: Any?
    private var screenObserver: NSObjectProtocol?
    private var floating: FloatingDashboard?
    private var statusItem: NSStatusItem?
    private let displayMenu = NSMenu(title: "Displays")
    private let preferences = DesktopPreferences()
    private lazy var appLock = AppLockCoordinator(preferences: preferences)
    private lazy var menuPreferences = PreferencesMenu(preferences)
    private let background = CommandLine.arguments.contains("--background")

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMenus()
        floating = FloatingDashboard(preferences: preferences, lockCoordinator: appLock)
        appLock.onLockedChanged = { [weak self] locked in self?.floating?.setPreviewActive(locked) }
        appLock.onNeedsPassword = { [weak self] in self?.floating?.showLockSettings() }
        inputMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if self?.appLock.isLocked == true {
                let blocked = event.modifierFlags.contains(.command) && ["q", "w", "m", "h", "f", "0", "1", "s"].contains(event.charactersIgnoringModifiers?.lowercased() ?? "")
                if event.keyCode == 53 || blocked { return nil }
            }
            return event
        }
        screenObserver = NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification,
            object: nil, queue: .main) { [weak self] _ in self?.updateDisplays() }
        RuntimeSetup.prepare { [weak self] error in
            guard let self else { return }
            if let error {
                if self.background { NSLog("Agent Ops setup failed: %@", error); return }
                let alert = NSAlert(); alert.messageText = "Agent Ops Setup"
                alert.informativeText = error; alert.runModal(); return
            }
            if self.background { return }
            if CommandLine.arguments.contains("--preview") || CommandLine.arguments.contains("--single") {
                self.appLock.enter(original: CommandLine.arguments.contains("--single"))
            } else { self.showFloating() }
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    private func actions() -> NSMenu {
        let menu = NSMenu()
        for (title, action, key) in [("Show Floating Dashboard", #selector(showFloating), "0"),
                                     ("Lock All Displays", #selector(previewAll), "1"),
                                     ("Lock Original Layout", #selector(previewSingle), "s")] {
            let item = menu.addItem(withTitle: title, action: action, keyEquivalent: key); item.target = self
        }
        menu.addItem(.separator())
        let onTop = menu.addItem(withTitle: "Always on Top", action: #selector(toggleAlwaysOnTop(_:)), keyEquivalent: "")
        onTop.target = self; onTop.identifier = NSUserInterfaceItemIdentifier("alwaysOnTop")
        onTop.state = preferences.alwaysOnTop ? .on : .off
        menu.addItem(.separator())
        let password = menu.addItem(withTitle: "Password Settings…", action: #selector(openPasswordSettings), keyEquivalent: "")
        password.target = self
        let settings = menu.addItem(withTitle: "Screen Saver Settings…", action: #selector(openSettings), keyEquivalent: "")
        settings.target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Agent Ops", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        return menu
    }

    private func installMenus() {
        let menu = NSMenu(), appItem = NSMenuItem()
        appItem.submenu = actions(); menu.addItem(appItem)
        let windowItem = NSMenuItem(title: "Window", action: nil, keyEquivalent: "")
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Resize", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowItem.submenu = windowMenu; menu.addItem(windowItem)
        let screenItem = NSMenuItem(title: "Displays", action: nil, keyEquivalent: "")
        screenItem.submenu = displayMenu; menu.addItem(screenItem); NSApp.mainMenu = menu
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        let statusImage = NSImage(named: "MenuBarIconTemplate")
            ?? NSImage(systemSymbolName: "point.3.connected.trianglepath.dotted", accessibilityDescription: "Agent Ops")
        statusImage?.accessibilityDescription = "Agent Ops"
        statusItem?.button?.image = statusImage
        statusItem?.menu = actions()
        updateDisplays()
        menuPreferences.attach(menu)
        if let statusMenu = statusItem?.menu { menuPreferences.attach(statusMenu) }
    }

    private func updateDisplays() {
        displayMenu.removeAllItems()
        for (index, screen) in NSScreen.screens.enumerated() {
            let item = displayMenu.addItem(withTitle: screen.localizedName, action: #selector(focusDisplay(_:)), keyEquivalent: String(index + 2))
            item.tag = index; item.target = self
        }
    }
    @objc private func previewAll() { appLock.enter() }
    @objc private func previewSingle() { appLock.enter(original: true) }
    @objc private func showFloating() {
        guard !appLock.isLocked else { appLock.focusDisplay(0); return }
        floating?.show()
    }
    @objc private func openPasswordSettings() { if !appLock.isLocked { floating?.showLockSettings() } }
    @objc private func focusDisplay(_ sender: NSMenuItem) { appLock.focusDisplay(sender.tag) }
    @objc private func toggleAlwaysOnTop(_ sender: NSMenuItem) {
        floating?.setAlwaysOnTop(!preferences.alwaysOnTop)
        sender.state = preferences.alwaysOnTop ? .on : .off
    }
    @objc private func openSettings() {
        guard !appLock.isLocked else { return }
        if let url = URL(string: "x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension") { NSWorkspace.shared.open(url) }
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        NSApp.setActivationPolicy(.regular)
        showFloating()
        return true
    }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        appLock.isLocked && !appLock.systemEnding ? .terminateCancel : .terminateNow
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationWillTerminate(_ notification: Notification) {
        appLock.dispose(); floating?.dispose()
        if let inputMonitor { NSEvent.removeMonitor(inputMonitor) }
        if let screenObserver { NotificationCenter.default.removeObserver(screenObserver) }
    }
}

@main
struct PreviewEntry {
    static func main() {
        let app = NSApplication.shared, delegate = PreviewDelegate()
        app.setActivationPolicy(CommandLine.arguments.contains("--background") ? .accessory : .regular)
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}
