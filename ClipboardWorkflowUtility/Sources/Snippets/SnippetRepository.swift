import Foundation

public protocol SnippetRepository {
    func fetchAll() -> [Snippet]
    func save(_ snippet: Snippet)
    func delete(id: UUID)
}

public final class InMemorySnippetRepository: SnippetRepository {
    private var snippets: [Snippet] = []

    public init() {}

    public func fetchAll() -> [Snippet] {
        snippets.sorted { lhs, rhs in
            if lhs.pinned != rhs.pinned { return lhs.pinned && !rhs.pinned }
            return lhs.updatedAt > rhs.updatedAt
        }
    }

    public func save(_ snippet: Snippet) {
        snippets.removeAll { $0.id == snippet.id }
        snippets.append(snippet)
    }

    public func delete(id: UUID) {
        snippets.removeAll { $0.id == id }
    }
}
