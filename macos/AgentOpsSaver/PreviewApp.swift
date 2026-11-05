import AppKit

final class PreviewWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

final class PreviewDelegate: NSObject, NSApplicationDelegate {
    private var windows: [NSWindow] = []
    private var views: [AgentOpsSaverView] = []
    private var inputMonitor: Any?
    private var screenObserver: NSObjectProtocol?
    private var floating: FloatingDashboard?
    private var statusItem: NSStatusItem?
    private var single = false
    private var previewing = false
    private let displayMenu = NSMenu(title: "Displays")
    private let preferences = DesktopPreferences()
    private lazy var menuPreferences = PreferencesMenu(preferences)
    private let background = CommandLine.arguments.contains("--background")

    func applicationDidFinishLaunching(_ notification: Notification) {
        installMenus()
        floating = FloatingDashboard(preferences: preferences)
        inputMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.keyCode == 53, self?.previewing == true { self?.showFloating(); return nil }; return event
        }
        screenObserver = NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification,
            object: nil, queue: .main) { [weak self] _ in if self?.previewing == true { self?.rebuild() } }
        RuntimeSetup.prepare { [weak self] error in
            guard let self else { return }
            if let error {
                if self.background { NSLog("Agent Ops setup failed: %@", error); return }
                let alert = NSAlert(); alert.messageText = "Agent Ops Setup"
                alert.informativeText = error; alert.runModal(); return
            }
            if self.background { return }
            if CommandLine.arguments.contains("--preview") || CommandLine.arguments.contains("--single") {
                self.single = CommandLine.arguments.contains("--single"); self.startPreview()
            } else { self.showFloating() }
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    private func actions() -> NSMenu {
        let menu = NSMenu()
        for (title, action, key) in [("Show Floating Dashboard", #selector(showFloating), "0"),
                                     ("Preview Linked Displays", #selector(previewAll), "1"),
                                     ("Preview Single Display", #selector(previewSingle), "s")] {
            let item = menu.addItem(withTitle: title, action: action, keyEquivalent: key); item.target = self
        }
        menu.addItem(.separator())
        let onTop = menu.addItem(withTitle: "Always on Top", action: #selector(toggleAlwaysOnTop(_:)), keyEquivalent: "")
        onTop.target = self; onTop.identifier = NSUserInterfaceItemIdentifier("alwaysOnTop")
        onTop.state = preferences.alwaysOnTop ? .on : .off
        menu.addItem(.separator())
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
        statusItem?.button?.image = NSImage(systemSymbolName: "point.3.connected.trianglepath.dotted", accessibilityDescription: "Agent Ops")
        statusItem?.menu = actions()
        menuPreferences.attach(menu)
        if let statusMenu = statusItem?.menu { menuPreferences.attach(statusMenu) }
    }

    private func clearPreview() {
        views.forEach { $0.stopAnimation() }; views.removeAll()
        windows.forEach { $0.contentView = nil; $0.close() }; windows.removeAll()
        displayMenu.removeAllItems()
    }

    private func rebuild() {
        clearPreview()
        let screens = single ? Array(NSScreen.screens.prefix(1)) : NSScreen.screens
        for screen in screens {
            let frame = screen.frame
            let window = PreviewWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
            window.setFrame(frame, display: true)
            window.title = "Agent Ops · \(screen.localizedName) · Esc to Desktop"
            window.backgroundColor = .black; window.isReleasedWhenClosed = false
            if let view = AgentOpsSaverView(frame: NSRect(origin: .zero, size: frame.size), isPreview: false) {
                view.forceSingleDisplay = single
                window.contentView = view; views.append(view)
                window.makeKeyAndOrderFront(nil); view.startAnimation()
            }
            windows.append(window)
            let item = displayMenu.addItem(withTitle: screen.localizedName, action: #selector(focusDisplay(_:)), keyEquivalent: String(windows.count + 1))
            item.tag = windows.count - 1; item.target = self
        }
    }

    private func startPreview() { previewing = true; floating?.setPreviewActive(true); rebuild() }
    @objc private func previewAll() { single = false; startPreview() }
    @objc private func previewSingle() { single = true; startPreview() }
    @objc private func showFloating() { previewing = false; clearPreview(); floating?.setPreviewActive(false); floating?.show() }
    @objc private func focusDisplay(_ sender: NSMenuItem) { windows[sender.tag].makeKeyAndOrderFront(nil) }
    @objc private func toggleAlwaysOnTop(_ sender: NSMenuItem) {
        floating?.setAlwaysOnTop(!preferences.alwaysOnTop)
        sender.state = preferences.alwaysOnTop ? .on : .off
    }
    @objc private func openSettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.ScreenSaver-Settings.extension") { NSWorkspace.shared.open(url) }
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        NSApp.setActivationPolicy(.regular)
        if !previewing || !flag { showFloating() }
        return true
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationWillTerminate(_ notification: Notification) {
        clearPreview(); floating?.dispose()
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
