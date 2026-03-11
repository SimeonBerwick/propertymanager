import Foundation

public protocol ClipboardRepository {
    func fetchHistory(limit: Int) -> [ClipboardItem]
    func saveClipboardText(_ text: String, sourceAppBundleID: String?)
    func deleteHistoryItem(id: UUID)
    func clearHistory()
}

public final class InMemoryClipboardRepository: ClipboardRepository {
    private var items: [ClipboardItem] = []
    private let settingsProvider: () -> AppSettings

    public init(settingsProvider: @escaping () -> AppSettings = { AppSettings() }) {
        self.settingsProvider = settingsProvider
    }

    public func fetchHistory(limit: Int) -> [ClipboardItem] {
        Array(items.prefix(limit))
    }

    public func saveClipboardText(_ text: String, sourceAppBundleID: String?) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        if let first = items.first, first.text == trimmed {
            return
        }

        items.insert(ClipboardItem(text: trimmed, sourceAppBundleID: sourceAppBundleID), at: 0)
        let maxItems = max(1, settingsProvider().maxHistoryItems)
        if items.count > maxItems {
            items = Array(items.prefix(maxItems))
        }
    }

    public func deleteHistoryItem(id: UUID) {
        items.removeAll { $0.id == id }
    }

    public func clearHistory() {
        items.removeAll()
    }
}
