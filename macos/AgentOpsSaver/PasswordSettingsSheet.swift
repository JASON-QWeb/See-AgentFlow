import AppKit

final class PasswordSettingsSheet: NSObject {
    let panel: NSPanel
    private let current = NSSecureTextField()
    private let newPassword = NSSecureTextField()
    private let confirmation = NSSecureTextField()
    private let message = NSTextField(labelWithString: "")
    private let save = NSButton()
    private let cancel = NSButton()
    private let preferences: DesktopPreferences
    private let configured: Bool
    var onSave: ((String, String, @escaping (String?) -> Void) -> Void)?
    var onFinish: ((Bool) -> Void)?

    init(preferences: DesktopPreferences, configured: Bool) {
        self.preferences = preferences; self.configured = configured
        panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 430, height: 350),
                        styleMask: [.titled], backing: .buffered, defer: false)
        panel.title = preferences.text("Fullscreen password"); panel.isReleasedWhenClosed = false
        panel.appearance = NSAppearance(named: .darkAqua)
        super.init()
        guard let content = panel.contentView else { return }
        let hint = NSTextField(wrappingLabelWithString: preferences.text("Use 6–128 characters."))
        hint.frame = NSRect(x: 24, y: 302, width: 382, height: 24); content.addSubview(hint)
        var y: CGFloat = 242
        let fields = configured ? [("Current password", current), ("New password", newPassword), ("Confirm password", confirmation)]
            : [("New password", newPassword), ("Confirm password", confirmation)]
        for (title, field) in fields {
            let label = NSTextField(labelWithString: preferences.text(title))
            label.frame = NSRect(x: 24, y: y + 28, width: 382, height: 20)
            field.frame = NSRect(x: 24, y: y, width: 382, height: 26)
            field.setAccessibilityLabel(preferences.text(title))
            content.addSubview(label); content.addSubview(field); y -= 65
        }
        message.frame = NSRect(x: 24, y: 50, width: 382, height: 40)
        message.textColor = .systemRed; message.maximumNumberOfLines = 2; content.addSubview(message)
        save.title = preferences.text("Save password"); save.bezelStyle = .rounded
        save.frame = NSRect(x: 254, y: 10, width: 152, height: 32); save.keyEquivalent = "\r"
        save.target = self; save.action = #selector(savePassword); content.addSubview(save)
        cancel.title = preferences.text("Cancel"); cancel.bezelStyle = .rounded
        cancel.frame = NSRect(x: 145, y: 10, width: 100, height: 32); cancel.keyEquivalent = "\u{1b}"
        cancel.target = self; cancel.action = #selector(cancelSheet); content.addSubview(cancel)
    }
    func present(on parent: NSWindow) {
        parent.beginSheet(panel)
        panel.makeFirstResponder(configured ? current : newPassword)
    }
    @objc private func savePassword() {
        guard newPassword.stringValue == confirmation.stringValue else {
            message.stringValue = preferences.text("Passwords do not match."); return
        }
        let old = current.stringValue, value = newPassword.stringValue
        clear(); save.isEnabled = false; cancel.isEnabled = false
        onSave?(old, value) { [weak self] error in
            guard let self else { return }
            self.save.isEnabled = true; self.cancel.isEnabled = true
            if let error { self.message.stringValue = self.preferences.text(error); self.panel.makeFirstResponder(self.configured ? self.current : self.newPassword) }
            else { self.finish(saved: true) }
        }
    }
    @objc private func cancelSheet() { finish(saved: false) }
    func dismiss() { finish(saved: false) }
    private func clear() { current.stringValue = ""; newPassword.stringValue = ""; confirmation.stringValue = "" }
    private func finish(saved: Bool) {
        clear(); panel.sheetParent?.endSheet(panel); panel.orderOut(nil); onFinish?(saved)
    }
}
