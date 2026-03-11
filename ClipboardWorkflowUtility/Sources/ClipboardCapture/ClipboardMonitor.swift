import AppKit
import Foundation

public protocol ClipboardMonitorDelegate: AnyObject {
    func clipboardMonitor(didCaptureText text: String, sourceAppBundleID: String?)
}

public final class ClipboardMonitor {
    private let pasteboard: NSPasteboard
    private var timer: Timer?
    private var lastChangeCount: Int
    public weak var delegate: ClipboardMonitorDelegate?
    public var isPaused: Bool = false

    public init(pasteboard: NSPasteboard = .general) {
        self.pasteboard = pasteboard
        self.lastChangeCount = pasteboard.changeCount
    }

    public func start(interval: TimeInterval = 0.75) {
        stop()
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            self?.poll()
        }
    }

    public func stop() {
        timer?.invalidate()
        timer = nil
    }

    private func poll() {
        guard !isPaused else { return }
        guard pasteboard.changeCount != lastChangeCount else { return }
        lastChangeCount = pasteboard.changeCount

        guard let text = pasteboard.string(forType: .string) else { return }
        delegate?.clipboardMonitor(didCaptureText: text, sourceAppBundleID: NSWorkspace.shared.frontmostApplication?.bundleIdentifier)
    }
}
