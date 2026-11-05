import AppKit
import ScreenSaver

@objc(AgentOpsExtension)
final class AgentOpsExtension: ScreenSaverExtension {}

@objc(AgentOpsViewController)
final class AgentOpsViewController: ScreenSaverViewController {
    override func loadView() {
        view = AgentOpsSaverView(frame: .zero, isPreview: false) ?? NSView()
    }
}

@main
struct ExtensionEntry {
    static func main() { _ = NSExtensionMain(CommandLine.argc, CommandLine.unsafeArgv) }
}
