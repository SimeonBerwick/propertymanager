import Foundation
import Observation

@Observable
public final class SnippetViewModel {
    public private(set) var snippets: [Snippet] = []
    private let repository: SnippetRepository

    public init(repository: SnippetRepository) {
        self.repository = repository
        reload()
    }

    public func reload() {
        snippets = repository.fetchAll()
    }

    public func save(title: String, body: String, folder: String? = nil, tags: [String] = []) {
        let snippet = Snippet(title: title, body: body, folder: folder, tags: tags)
        repository.save(snippet)
        reload()
    }

    public func delete(_ snippet: Snippet) {
        repository.delete(id: snippet.id)
        reload()
    }
}
