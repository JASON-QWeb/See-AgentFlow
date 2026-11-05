import AppKit

@main
struct PreferencesTests {
    static func main() throws {
        // Never show or activate a window: this suite must not interrupt the user's desktop.
        NSApplication.shared.setActivationPolicy(.prohibited)
        let name = "local.agentops.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { defaults.removePersistentDomain(forName: name); try? FileManager.default.removeItem(at: directory) }
        let file = directory.appendingPathComponent("preferences.json")
        let preferences = DesktopPreferences(defaults: defaults, file: file)
        precondition(preferences.alwaysOnTop && preferences.language == "en")
        let floating = FloatingDashboard(preferences: preferences)
        defer { floating.dispose() }
        precondition(!floating.window.isVisible && floating.window.level == .floating)
        let menu = NSMenu(), item = NSMenuItem(title: "Always on Top", action: nil, keyEquivalent: "")
        item.identifier = NSUserInterfaceItemIdentifier("alwaysOnTop"); menu.addItem(item)
        let controller = PreferencesMenu(preferences); controller.attach(menu)
        precondition(item.state == .on && item.title == "Always on Top")
        floating.setAlwaysOnTop(false); controller.menuNeedsUpdate(menu)
        precondition(item.state == .off && floating.window.level == .normal && !floating.window.isFloatingPanel)
        precondition(!DesktopPreferences(defaults: defaults, file: file).alwaysOnTop)
        try Data(#"{"theme":"white","language":"zh-CN"}"#.utf8).write(to: file)
        controller.menuNeedsUpdate(menu)
        precondition(item.title == "置顶" && item.state == .off)
        floating.setAlwaysOnTop(true)
        try Data(#"{"theme":"white","language":"zh-TW"}"#.utf8).write(to: file)
        controller.menuNeedsUpdate(menu)
        precondition(item.title == "置頂" && item.state == .on && floating.window.level == .floating)
        precondition(!floating.window.isVisible)
        print("Native preferences passed: default checked, normal/floating levels, persisted toggle, three menu languages; no windows shown")
    }
}
