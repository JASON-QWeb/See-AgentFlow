import AppKit
import WebKit
import OSLog

final class SaverWebView: NSObject, WKNavigationDelegate {
    let view: WKWebView
    private var retry: Timer?
    private var disposed = false
    private var currentLayout: String
    private var desktopSize: NSSize
    private weak var container: NSView?
    private var statusLabel: NSTextField?
    private let path: String
    private let logger = Logger(subsystem: "local.agentops.screensaver", category: "webview")

    init(container: NSView, layout: DisplayLayout, path: String = "/screensaver") {
        self.path = path
        self.container = container
        currentLayout = layout.json
        desktopSize = container.bounds.size
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = path == "/screensaver" ? .nonPersistent() : .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.userContentController.addUserScript(WKUserScript(
            source: "window.__AGENT_SAVER_LAYOUT__ = \(layout.json); window.__AGENT_DESKTOP_SIZE__ = {width: \(desktopSize.width), height: \(desktopSize.height)};",
            injectionTime: .atDocumentStart, forMainFrameOnly: true))
        view = WKWebView(frame: container.bounds, configuration: configuration)
        super.init()
        view.autoresizingMask = [.width, .height]
        view.navigationDelegate = self
        view.underPageBackgroundColor = .black
        configureScreenSaverVisibility()
        container.addSubview(view)
        load()
    }

    private func configureScreenSaverVisibility() {
        guard Bundle.main.bundleIdentifier == "local.agentops.saver.extension" else { return }
        // WallpaperAgent's remote windows report themselves as occluded even while
        // displaying the saver. WebKit otherwise freezes their layers after 3 seconds.
        // Only this extension opts out; AgentOpsSaverView still disposes on stop/sleep.
        let setter = NSSelectorFromString("_setWindowOcclusionDetectionEnabled:")
        guard view.responds(to: setter) else {
            logger.error("Screen saver visibility compatibility is unavailable")
            return
        }
        view.setValue(false, forKey: "windowOcclusionDetectionEnabled")
        logger.notice("Screen saver remote-window visibility enabled")
    }

    func update(layout: DisplayLayout) {
        guard !disposed, layout.json != currentLayout else { return }
        currentLayout = layout.json
        view.evaluateJavaScript("window.dispatchEvent(new CustomEvent('agent-saver-layout', {detail: \(layout.json)}));", completionHandler: nil)
    }

    func updateDesktopSize(_ size: NSSize) {
        guard !disposed, size != desktopSize else { return }
        desktopSize = size; publishDesktopSize()
    }

    private func publishDesktopSize() {
        guard path == "/?desktop=1", !disposed else { return }
        view.evaluateJavaScript("window.__AGENT_DESKTOP_SIZE__ = {width: \(desktopSize.width), height: \(desktopSize.height)}; window.dispatchEvent(new CustomEvent('agent-desktop-size', {detail: window.__AGENT_DESKTOP_SIZE__}));", completionHandler: nil)
    }

    private func load() {
        guard !disposed, let url = URL(string: "http://127.0.0.1:4318\(path)") else { return }
        view.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8))
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        logger.info("Local page loaded: \(self.path, privacy: .public)")
        statusLabel?.removeFromSuperview(); statusLabel = nil
        retry?.invalidate(); retry = nil
        publishDesktopSize()
        view.evaluateJavaScript("window.dispatchEvent(new CustomEvent('agent-saver-layout', {detail: \(currentLayout)}));", completionHandler: nil)
    }

    private func failed() {
        guard !disposed else { return }
        if statusLabel == nil, let container {
            let label = NSTextField(labelWithString: "AGENT OPS\nCONNECTING TO LOCAL OBSERVER…")
            label.textColor = NSColor(calibratedRed: 0.55, green: 0.96, blue: 0.85, alpha: 1)
            label.font = .monospacedSystemFont(ofSize: 20, weight: .regular)
            label.alignment = .center
            label.frame = NSRect(x: 0, y: container.bounds.midY - 40, width: container.bounds.width, height: 80)
            label.autoresizingMask = [.width, .minYMargin, .maxYMargin]
            container.addSubview(label); statusLabel = label
        }
        retry?.invalidate()
        retry = Timer.scheduledTimer(withTimeInterval: 5, repeats: false) { [weak self] _ in self?.load() }
    }

    private func navigationFailed(_ error: Error) {
        let failure = error as NSError
        logger.error("Local page failed: \(failure.domain, privacy: .public) / \(failure.code)")
        failed()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { navigationFailed(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { navigationFailed(error) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        logger.error("Local page content process terminated")
        failed()
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = navigationAction.request.url
        // The saver renders only the local observer; logs cannot navigate to external sites.
        decisionHandler(url?.host == "127.0.0.1" && url?.port == 4318 && navigationAction.targetFrame != nil ? .allow : .cancel)
    }

    func dispose() {
        guard !disposed else { return }
        disposed = true; retry?.invalidate(); retry = nil
        view.stopLoading(); view.navigationDelegate = nil
        view.configuration.userContentController.removeAllUserScripts()
        view.removeFromSuperview(); statusLabel?.removeFromSuperview(); statusLabel = nil
    }

    deinit { retry?.invalidate() }
}
