import AppKit
import OSLog

final class FloatingDashboard: NSObject, NSWindowDelegate {
    let window: NSPanel
    private var web: SaverWebView?
    private let preferences: DesktopPreferences
    private var wantsVisible = false
    private var locked = false
    private var saverActive = false
    private var sleeping = false
    private var previewActive = false
    private var distributed: [NSObjectProtocol] = []
    private var workspace: [NSObjectProtocol] = []
    private let logger = Logger(subsystem: "local.agentops.desktop", category: "lifecycle")

    init(preferences: DesktopPreferences = DesktopPreferences()) {
        self.preferences = preferences
        window = NSPanel(contentRect: NSRect(x: 80, y: 80, width: 1120, height: 760),
                         styleMask: [.titled, .closable, .resizable, .miniaturizable, .fullSizeContentView], backing: .buffered, defer: false)
        super.init()
        window.title = "Agent Ops"
        window.titleVisibility = .hidden; window.titlebarAppearsTransparent = true
        window.titlebarSeparatorStyle = .none; window.appearance = NSAppearance(named: .darkAqua)
        for kind in [NSWindow.ButtonType.closeButton, .miniaturizeButton, .zoomButton] {
            window.standardWindowButton(kind)?.isHidden = true
        }
        // Place controls in AppKit's title-bar layer so its drag hit area cannot cover them.
        let chrome = NSTitlebarAccessoryViewController()
        chrome.layoutAttribute = .right
        chrome.view = FloatingChrome(frame: NSRect(x: 0, y: 0, width: 88, height: 22))
        window.addTitlebarAccessoryViewController(chrome)
        window.backgroundColor = .black; window.isReleasedWhenClosed = false
        window.minSize = NSSize(width: 560, height: 400)
        applyWindowLevel(); window.hidesOnDeactivate = false
        window.isMovableByWindowBackground = true
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.delegate = self
        if !window.setFrameAutosaveName("AgentOpsFloatingFrame") { window.center() }
        observeLifecycle()
    }

    private func observeLifecycle() {
        let center = DistributedNotificationCenter.default()
        let notifications: [(String, (FloatingDashboard) -> Void)] = [
            ("com.apple.screenIsLocked", { $0.locked = true }),
            ("com.apple.screenIsUnlocked", { $0.locked = false; $0.saverActive = false }),
            ("com.apple.screensaver.didstart", { $0.saverActive = true }),
            ("com.apple.screensaver.didstop", { $0.saverActive = false })
        ]
        for (name, update) in notifications {
            distributed.append(center.addObserver(forName: .init(name), object: nil, queue: .main) { [weak self] _ in
                guard let self else { return }; update(self); self.refresh()
            })
        }
        let workspaceCenter = NSWorkspace.shared.notificationCenter
        for (name, value) in [(NSWorkspace.screensDidSleepNotification, true), (NSWorkspace.screensDidWakeNotification, false)] {
            workspace.append(workspaceCenter.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.sleeping = value; self?.refresh()
            })
        }
    }

    func show() {
        wantsVisible = true
        if window.isMiniaturized { window.deminiaturize(nil) }
        refresh()
        if !locked && !saverActive && !sleeping && !previewActive { window.makeKeyAndOrderFront(nil) }
    }

    func setPreviewActive(_ value: Bool) { previewActive = value; refresh() }

    func setAlwaysOnTop(_ value: Bool) {
        preferences.alwaysOnTop = value; applyWindowLevel()
    }
    private func applyWindowLevel() {
        window.isFloatingPanel = preferences.alwaysOnTop
        window.level = preferences.alwaysOnTop ? .floating : .normal
    }

    private func refresh() {
        // didstop can arrive before unlock; retain lock state independently.
        guard wantsVisible, !locked, !saverActive, !sleeping, !previewActive, !window.isMiniaturized else {
            releaseRenderer(); window.orderOut(nil); return
        }
        if web == nil, let container = window.contentView {
            let layout = DisplayLayout.make(screen: window.screen, preview: true)
            web = SaverWebView(container: container, layout: layout, path: "/?desktop=1")
            fitDashboard()
            logger.notice("floating renderer started")
        }
        window.orderFront(nil)
    }

    private func releaseRenderer() {
        if web != nil { logger.notice("floating renderer released") }
        web?.dispose(); web = nil
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        wantsVisible = false; refresh(); return false
    }
    func windowDidMiniaturize(_ notification: Notification) { releaseRenderer() }
    func windowDidDeminiaturize(_ notification: Notification) { refresh() }
    func windowDidResize(_ notification: Notification) { fitDashboard() }
    func windowDidEndLiveResize(_ notification: Notification) { window.saveFrame(usingName: "AgentOpsFloatingFrame") }
    private func fitDashboard() {
        guard let size = window.contentView?.bounds.size else { return }
        let compact = size.width < 1120 || size.height < 700
        web?.view.pageZoom = min(1, min(size.width / 1100, size.height / (compact ? 620 : 730)))
        web?.updateDesktopSize(size)
    }
    func dispose() { releaseRenderer(); window.orderOut(nil) }

    deinit {
        releaseRenderer()
        distributed.forEach { DistributedNotificationCenter.default().removeObserver($0) }
        workspace.forEach { NSWorkspace.shared.notificationCenter.removeObserver($0) }
    }
}
