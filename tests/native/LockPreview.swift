import AppKit

final class LockPreviewDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow?
    var web: SaverWebView?
    func applicationDidFinishLaunching(_ notification: Notification) {
        // A visual test may only use the explicitly allowed secondary display.
        guard let screen = NSScreen.screens.first(where: { $0.localizedName.contains("27B30H") }) else { NSApp.terminate(nil); return }
        let frame = NSRect(x: screen.frame.midX - 500, y: screen.frame.midY - 350, width: 1000, height: 700)
        let window = NSWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
        self.window = window; window.isReleasedWhenClosed = false
        window.title = "AgentFlow Lock Card Preview"; window.backgroundColor = .black
        window.level = .floating
        let container = NSView(frame: NSRect(origin: .zero, size: frame.size)); window.contentView = container
        web = SaverWebView(container: container, layout: DisplayLayout.make(screen: screen, preview: true))
        container.addSubview(LockPromptView(frame: container.bounds, preferences: DesktopPreferences()))
        window.orderFrontRegardless() // Do not activate the App or steal keyboard focus from the primary screen.
        Timer.scheduledTimer(withTimeInterval: 60, repeats: false) { _ in NSApp.terminate(nil) }
    }
    func applicationWillTerminate(_ notification: Notification) { web?.dispose(); window?.close() }
}

@main
struct LockPreviewEntry {
    static func main() {
        let app = NSApplication.shared, delegate = LockPreviewDelegate()
        app.setActivationPolicy(.accessory); app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}
