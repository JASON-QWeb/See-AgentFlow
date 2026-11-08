import AppKit

private final class LockTitle: NSView {
    var tapped: (() -> Void)?
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func hitTest(_ point: NSPoint) -> NSView? { super.hitTest(point) == nil ? nil : self }
    override func mouseDown(with event: NSEvent) { tapped?() }
}

final class LockPromptView: NSView, NSTextFieldDelegate {
    private let password = NSSecureTextField()
    private let message = NSTextField(labelWithString: "")
    private let submit = NSButton()
    private let preferences: DesktopPreferences
    var onSubmit: ((String) -> Void)?
    var onTitleTap: (() -> Void)?
    var onDismiss: (() -> Void)?
    var onPasswordEdit: (() -> Void)?

    init(frame: NSRect, preferences: DesktopPreferences) {
        self.preferences = preferences
        super.init(frame: frame)
        appearance = NSAppearance(named: .darkAqua)
        wantsLayer = true; layer?.backgroundColor = NSColor.black.withAlphaComponent(0.32).cgColor
        autoresizingMask = [.width, .height]
        let card = NSView(); card.wantsLayer = true
        card.layer?.backgroundColor = NSColor(calibratedWhite: 0.035, alpha: 0.97).cgColor
        card.layer?.borderColor = NSColor(calibratedWhite: 0.55, alpha: 0.5).cgColor; card.layer?.borderWidth = 1
        addSubview(card); card.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([card.centerXAnchor.constraint(equalTo: centerXAnchor),
            card.centerYAnchor.constraint(equalTo: centerYAnchor), card.widthAnchor.constraint(equalToConstant: 380),
            card.heightAnchor.constraint(equalToConstant: 268)])
        let title = label(preferences.text("AGENT OPS / LOCKED"), size: 18, color: .white)
        let hint = label(preferences.text("Enter password to return to desktop."), size: 12, color: .lightGray)
        let titleArea = LockTitle(frame: NSRect(x: 28, y: 212, width: min(284, ceil(title.fittingSize.width)), height: 26))
        title.frame = titleArea.bounds
        titleArea.tapped = { [weak self] in self?.onTitleTap?() }
        titleArea.addSubview(title)
        hint.frame = NSRect(x: 28, y: 178, width: 324, height: 25)
        card.addSubview(titleArea); card.addSubview(hint)
        let closeLabel = preferences.text("Hide password prompt")
        let close = NSButton(title: "×", target: self, action: #selector(dismiss))
        close.isBordered = false; close.font = .systemFont(ofSize: 20, weight: .regular)
        close.frame = NSRect(x: 326, y: 211, width: 32, height: 28)
        close.toolTip = closeLabel; close.setAccessibilityLabel(closeLabel)
        card.addSubview(close)
        let border = NSView(frame: NSRect(x: 28, y: 110, width: 324, height: 54))
        border.wantsLayer = true; border.layer?.borderWidth = 1.5
        border.layer?.borderColor = NSColor(calibratedWhite: 0.85, alpha: 0.9).cgColor
        border.setAccessibilityIdentifier("agent-lock-password-border")
        password.frame = NSRect(x: 10, y: 12, width: 304, height: 28)
        password.isBordered = false; password.drawsBackground = false; password.textColor = .white
        password.font = .monospacedSystemFont(ofSize: 18, weight: .regular); password.focusRingType = .none
        password.placeholderAttributedString = NSAttributedString(string: preferences.text("Password"),
            attributes: [.foregroundColor: NSColor.gray, .font: NSFont.monospacedSystemFont(ofSize: 18, weight: .regular)])
        password.delegate = self
        password.setAccessibilityLabel(preferences.text("Password")); password.target = self; password.action = #selector(unlock)
        border.addSubview(password); card.addSubview(border)
        submit.title = preferences.text("Unlock"); submit.bezelStyle = .rounded
        submit.isBordered = false; submit.wantsLayer = true
        submit.layer?.backgroundColor = NSColor(calibratedWhite: 0.9, alpha: 1).cgColor
        submit.layer?.cornerRadius = 3
        submit.attributedTitle = NSAttributedString(string: preferences.text("Unlock"), attributes: [
            .foregroundColor: NSColor.black, .font: NSFont.monospacedSystemFont(ofSize: 13, weight: .medium)])
        submit.frame = NSRect(x: 28, y: 53, width: 324, height: 36)
        submit.target = self; submit.action = #selector(unlock); card.addSubview(submit)
        message.frame = NSRect(x: 28, y: 16, width: 324, height: 26)
        message.font = .systemFont(ofSize: 11); message.textColor = .systemRed
        message.lineBreakMode = .byWordWrapping; message.maximumNumberOfLines = 2
        card.addSubview(message)
    }
    required init?(coder: NSCoder) { nil }
    private func label(_ text: String, size: CGFloat, color: NSColor) -> NSTextField {
        let field = NSTextField(labelWithString: text)
        field.font = .monospacedSystemFont(ofSize: size, weight: .medium); field.textColor = color
        return field
    }
    override func hitTest(_ point: NSPoint) -> NSView? { super.hitTest(point) ?? self }
    override func mouseDown(with event: NSEvent) { focus() }
    override func resetCursorRects() { addCursorRect(bounds, cursor: .arrow) }
    func focus() { if password.isEnabled, !isHidden { window?.makeFirstResponder(password) } }
    func hideAndClear() {
        if password.currentEditor() != nil { window?.makeFirstResponder(window) }
        password.stringValue = ""; message.stringValue = ""
        isHidden = true
    }
    func setBusy(_ busy: Bool, error: String = "") {
        submit.isEnabled = !busy; password.isEnabled = !busy
        message.stringValue = preferences.text(error)
        if !busy, window?.isKeyWindow == true { focus() }
    }
    @objc private func unlock() {
        guard submit.isEnabled else { return }
        let value = password.stringValue; password.stringValue = ""; onSubmit?(value)
    }
    @objc private func dismiss() { onDismiss?() }
    func control(_ control: NSControl, textView: NSTextView, doCommandBy selector: Selector) -> Bool {
        if selector == #selector(NSResponder.cancelOperation(_:)) { return true }
        return false
    }
    func controlTextDidChange(_ obj: Notification) {
        if password.stringValue.count > 128 { password.stringValue = String(password.stringValue.prefix(128)) }
        onPasswordEdit?()
    }
}
