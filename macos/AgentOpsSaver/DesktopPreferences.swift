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
    var lockAfterSaver: Bool {
        get { defaults.object(forKey: "AgentOpsLockAfterSaver") as? Bool ?? true }
        set { defaults.set(newValue, forKey: "AgentOpsLockAfterSaver") }
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
        "AGENT OPS / LOCKED": ["AGENT OPS / 已锁定", "AGENT OPS / 已鎖定"],
        "Lock All Displays": ["锁定全部屏幕", "鎖定所有螢幕"],
        "Lock Original Layout": ["锁定 · 原版布局", "鎖定 · 原版配置"],
        "Password Settings…": ["密码设置…", "密碼設定…"],
        "Fullscreen password": ["全屏密码", "全螢幕密碼"],
        "Use 6–128 characters.": ["请输入 6–128 个字符。", "請輸入 6–128 個字元。"],
        "Current password": ["当前密码", "目前密碼"], "New password": ["新密码", "新密碼"],
        "Confirm password": ["确认密码", "確認密碼"], "Save password": ["保存密码", "儲存密碼"],
        "Cancel": ["取消", "取消"], "Password": ["密码", "密碼"], "Unlock": ["解锁", "解鎖"],
        "Passwords do not match.": ["两次输入的密码不一致。", "兩次輸入的密碼不一致。"],
        "Current password is incorrect.": ["当前密码不正确。", "目前密碼不正確。"],
        "Password storage is unavailable.": ["密码存储不可用。", "密碼儲存無法使用。"],
        "Enter password to return to desktop.": ["输入密码返回桌面。", "輸入密碼返回桌面。"],
        "Hide password prompt": ["隐藏密码框", "隱藏密碼框"],
        "Incorrect password.": ["密码不正确。", "密碼不正確。"],
        "Too many attempts. Try again shortly.": ["尝试次数过多，请稍后再试。", "嘗試次數過多，請稍後再試。"],
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
