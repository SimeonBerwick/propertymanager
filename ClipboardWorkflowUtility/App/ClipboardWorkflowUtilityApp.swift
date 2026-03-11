import SwiftUI

@main
struct ClipboardWorkflowUtilityApp: App {
    @State private var viewModel = HistoryViewModel(
        repository: InMemoryClipboardRepository(),
        clipboardMonitor: ClipboardMonitor()
    )

    var body: some Scene {
        WindowGroup {
            HistoryView(viewModel: viewModel)
        }
    }
}
