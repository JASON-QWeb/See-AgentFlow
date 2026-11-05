import AppKit
import ScreenSaver
import OSLog

@objc(AgentOpsSaverView)
final class AgentOpsSaverView: ScreenSaverView {
    private var web: SaverWebView?
    private var observers: [NSObjectProtocol] = []
    private var distributed: [NSObjectProtocol] = []
    private var workspace: [NSObjectProtocol] = []
    private var activation: DispatchWorkItem?
    private var suspended = false
    var forceSingleDisplay = false
    private let logger = Logger(subsystem: "local.agentops.screensaver", category: "lifecycle")

    override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        wantsLayer = true
        layer?.backgroundColor = NSColor(calibratedRed: 0.031, green: 0.059, blue: 0.067, alpha: 1).cgColor
        animationTimeInterval = 1
        observeLifecycle()
    }

    required init?(coder: NSCoder) { super.init(coder: coder); observeLifecycle() }

    private func observeLifecycle() {
        let center = NotificationCenter.default
        for name in [NSApplication.didChangeScreenParametersNotification, NSWindow.didChangeScreenNotification] {
            observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in self?.scheduleSetup() })
        }
        for name in ["com.apple.screensaver.willstop", "com.apple.screensaver.didstop", "com.apple.screenIsUnlocked"] {
            distributed.append(DistributedNotificationCenter.default().addObserver(forName: .init(name), object: nil, queue: .main) { [weak self] _ in self?.suspend() })
        }
        distributed.append(DistributedNotificationCenter.default().addObserver(forName: .init("com.apple.screensaver.didstart"), object: nil, queue: .main) { [weak self] _ in self?.resume() })
        let workspaceCenter = NSWorkspace.shared.notificationCenter
        workspace.append(workspaceCenter.addObserver(forName: NSWorkspace.screensDidSleepNotification, object: nil, queue: .main) { [weak self] _ in self?.suspend() })
        workspace.append(workspaceCenter.addObserver(forName: NSWorkspace.screensDidWakeNotification, object: nil, queue: .main) { [weak self] _ in self?.resume() })
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window == nil { suspend() } else { resume() }
    }

    override func layout() { super.layout(); if !suspended { scheduleSetup() } }
    override func startAnimation() { super.startAnimation(); resume() }
    override func stopAnimation() { super.stopAnimation(); suspend() }
    override func animateOneFrame() {}
    override var acceptsFirstResponder: Bool { false }
    override func hitTest(_ point: NSPoint) -> NSView? { self }

    private func resume() { suspended = false; scheduleSetup() }

    private func scheduleSetup() {
        guard !suspended, window != nil, bounds.width > 10, bounds.height > 10 else { return }
        activation?.cancel()
        // The host initially puts every view on the main screen, then moves it to its display.
        let work = DispatchWorkItem { [weak self] in self?.setup() }
        activation = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25, execute: work)
    }

    private func setup() {
        guard !suspended, window != nil else { return }
        let layout = DisplayLayout.make(screen: window?.screen, preview: forceSingleDisplay || (isPreview && bounds.width < 640))
        if let web { web.update(layout: layout) }
        else {
            web = SaverWebView(container: self, layout: layout)
            logger.notice("renderer started: \(layout.json, privacy: .public)")
        }
    }

    private func suspend() {
        suspended = true; activation?.cancel(); activation = nil
        if web != nil { logger.notice("renderer released") }
        web?.dispose(); web = nil
    }

    deinit {
        activation?.cancel(); web?.dispose()
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        distributed.forEach { DistributedNotificationCenter.default().removeObserver($0) }
        workspace.forEach { NSWorkspace.shared.notificationCenter.removeObserver($0) }
    }
}
