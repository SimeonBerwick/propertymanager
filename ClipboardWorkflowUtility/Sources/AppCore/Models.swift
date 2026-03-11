import Foundation

public struct ClipboardItem: Identifiable, Codable, Equatable {
    public let id: UUID
    public let text: String
    public let createdAt: Date
    public let sourceAppBundleID: String?
    public var pinned: Bool

    public init(
        id: UUID = UUID(),
        text: String,
        createdAt: Date = Date(),
        sourceAppBundleID: String? = nil,
        pinned: Bool = false
    ) {
        self.id = id
        self.text = text
        self.createdAt = createdAt
        self.sourceAppBundleID = sourceAppBundleID
        self.pinned = pinned
    }
}

public struct Snippet: Identifiable, Codable, Equatable {
    public let id: UUID
    public var title: String
    public var body: String
    public var folder: String?
    public var tags: [String]
    public var pinned: Bool
    public let createdAt: Date
    public var updatedAt: Date
    public var useCount: Int

    public init(
        id: UUID = UUID(),
        title: String,
        body: String,
        folder: String? = nil,
        tags: [String] = [],
        pinned: Bool = false,
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        useCount: Int = 0
    ) {
        self.id = id
        self.title = title
        self.body = body
        self.folder = folder
        self.tags = tags
        self.pinned = pinned
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.useCount = useCount
    }
}

public struct AppSettings: Codable, Equatable {
    public var maxHistoryItems: Int
    public var capturePaused: Bool

    public init(maxHistoryItems: Int = 100, capturePaused: Bool = false) {
        self.maxHistoryItems = maxHistoryItems
        self.capturePaused = capturePaused
    }
}
