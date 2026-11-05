import AppKit

/// Subdued title-bar controls keep window chrome out of the visualization.
final class FloatingChrome: NSView {
    private var hovering = false
    private var controls: [NSButton] = []

    override init(frame: NSRect) {
        super.init(frame: frame)
        for (symbol, title, action) in [("minus", "Minimize", #selector(minimize)),
                                         ("arrow.up.left.and.arrow.down.right", "Resize", #selector(resizeWindow)),
                                         ("xmark", "Close", #selector(closeWindow))] {
            let button = NSButton(image: NSImage(systemSymbolName: symbol, accessibilityDescription: title)!,
                                  target: self, action: action)
            button.isBordered = false; button.contentTintColor = NSColor(white: 0.8, alpha: 1)
            button.imageScaling = .scaleProportionallyDown
            button.toolTip = title; button.setAccessibilityLabel(title)
            button.alphaValue = 0.32; addSubview(button); controls.append(button)
        }
        toolTip = "Window controls"
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layout() {
        super.layout()
        for (index, button) in controls.enumerated() {
            button.frame = NSRect(x: bounds.width - 76 + CGFloat(index) * 24, y: 3, width: 18, height: 16)
        }
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        trackingAreas.forEach(removeTrackingArea)
        addTrackingArea(NSTrackingArea(rect: bounds, options: [.activeAlways, .inVisibleRect, .mouseEnteredAndExited],
                                      owner: self, userInfo: nil))
    }

    override func mouseEntered(with event: NSEvent) { setHover(true) }
    override func mouseExited(with event: NSEvent) { setHover(false) }
    private func setHover(_ value: Bool) {
        hovering = value
        controls.forEach { $0.alphaValue = value ? 1 : 0.32 }
        needsDisplay = true
    }

    override func draw(_ dirtyRect: NSRect) {
        guard hovering else { return }
        NSColor(white: 0.035, alpha: 0.94).setFill(); bounds.fill()
    }

    override func mouseDown(with event: NSEvent) {
        if event.clickCount == 2 { window?.zoom(nil) }
        else { window?.performDrag(with: event) }
    }
    @objc private func minimize() { window?.miniaturize(nil) }
    @objc private func resizeWindow() { window?.zoom(nil) }
    @objc private func closeWindow() { window?.performClose(nil) }
}
