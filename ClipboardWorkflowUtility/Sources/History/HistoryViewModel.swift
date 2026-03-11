import AppKit
import Foundation
import Observation

@Observable
public final class HistoryViewModel: ClipboardMonitorDelegate {
    public private(set) var items: [ClipboardItem] = []
    public var settings: AppSettings

    private let repository: ClipboardRepository
    private let clipboardMonitor: ClipboardMonitor

    public init(
        repository: ClipboardRepository,
        clipboardMonitor: ClipboardMonitor,
        settings: AppSettings = AppSettings()
    ) {
        self.repository = repository
        self.clipboardMonitor = clipboardMonitor
        self.settings = settings
        self.clipboardMonitor.delegate = self
        reload()
    }

    public func startMonitoring() {
        clipboardMonitor.isPaused = settings.capturePaused
        clipboardMonitor.start()
    }

    public func stopMonitoring() {
        clipboardMonitor.stop()
    }

    public func reload() {
        items = repository.fetchHistory(limit: settings.maxHistoryItems)
    }

    public func copyToClipboard(_ item: ClipboardItem) {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(item.text, forType: .string)
    }

    public func delete(_ item: ClipboardItem) {
        repository.deleteHistoryItem(id: item.id)
        reload()
    }

    public func clearAll() {
        repository.clearHistory()
        reload()
    }

    public func setCapturePaused(_ paused: Bool) {
        settings.capturePaused = paused
        clipboardMonitor.isPaused = paused
    }

    public func clipboardMonitor(didCaptureText text: String, sourceAppBundleID: String?) {
        repository.saveClipboardText(text, sourceAppBundleID: sourceAppBundleID)
        reload()
    }
}
