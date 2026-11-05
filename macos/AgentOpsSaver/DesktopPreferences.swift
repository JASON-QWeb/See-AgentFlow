import AppKit

final class DesktopPreferences {
    private let defaults: UserDefaults
    private let file: URL
    private(set) var language = "en"
    init(defaults: UserDefaults = .standard, file: URL? = nil) {
        self.defaults = defaults
        self.file = file ?? FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Agent Ops/preferences.json")
        reloadLanguage()
    }
    var alwaysOnTop: Bool {
        get { defaults.object(forKey: "AgentOpsAlwaysOnTop") as? Bool ?? true }
        set { defaults.set(newValue, forKey: "AgentOpsAlwaysOnTop") }
    }
    func reloadLanguage() {
        guard let attributes = try? FileManager.default.attributesOfItem(atPath: file.path),
              let size = attributes[.size] as? NSNumber, size.intValue <= 1024,
              let data = try? Data(contentsOf: file),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let value = object["language"] as? String, ["en", "zh-CN", "zh-TW"].contains(value) else { return }
        language = value
    }
    func text(_ source: String) -> String {
        guard language != "en", let values = Self.labels[source] else { return source }
        return values[language == "zh-CN" ? 0 : 1]
    }
    private static let labels = [
        "Show Floating Dashboard": ["显示悬浮看板", "顯示浮動看板"],
        "Preview Linked Displays": ["预览多屏联动", "預覽多螢幕連動"],
        "Preview Single Display": ["预览单屏", "預覽單螢幕"],
        "Always on Top": ["置顶", "置頂"],
        "Screen Saver Settings…": ["屏保设置…", "螢幕保護程式設定…"],
        "Quit Agent Ops": ["退出 Agent Ops", "結束 Agent Ops"],
        "Window": ["窗口", "視窗"], "Displays": ["屏幕", "螢幕"],
        "Close": ["关闭", "關閉"], "Minimize": ["最小化", "最小化"],
        "Resize": ["缩放", "縮放"], "Window controls": ["窗口控制", "視窗控制"],
    ]
}

final class PreferencesMenu: NSObject, NSMenuDelegate {
    let preferences: DesktopPreferences
    init(_ preferences: DesktopPreferences) { self.preferences = preferences }
    func attach(_ menu: NSMenu) {
        menu.delegate = self
        for item in menu.items {
            if !item.isSeparatorItem { item.representedObject = item.title }
            if let submenu = item.submenu { attach(submenu) }
        }
        apply(menu)
    }
    func menuNeedsUpdate(_ menu: NSMenu) {
        // Read only when opening a menu; no background polling or additional stream clients.
        preferences.reloadLanguage(); apply(menu)
        if let main = NSApp?.mainMenu { apply(main) }
    }
    private func apply(_ menu: NSMenu) {
        for item in menu.items {
            if let source = item.representedObject as? String { item.title = preferences.text(source) }
            if item.identifier?.rawValue == "alwaysOnTop" { item.state = preferences.alwaysOnTop ? .on : .off }
            if let submenu = item.submenu { apply(submenu) }
        }
    }
}
