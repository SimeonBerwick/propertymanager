import SwiftUI

public struct HistoryView: View {
    @Bindable var viewModel: HistoryViewModel

    public init(viewModel: HistoryViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        NavigationStack {
            List {
                Section {
                    Toggle("Pause clipboard capture", isOn: Binding(
                        get: { viewModel.settings.capturePaused },
                        set: { viewModel.setCapturePaused($0) }
                    ))
                }

                Section("Recent Clipboard Items") {
                    if viewModel.items.isEmpty {
                        Text("No clipboard items yet.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(viewModel.items) { item in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(item.text)
                                    .lineLimit(3)
                                HStack {
                                    Text(item.createdAt, style: .time)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    if let sourceAppBundleID = item.sourceAppBundleID {
                                        Text(sourceAppBundleID)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                viewModel.copyToClipboard(item)
                            }
                            .contextMenu {
                                Button("Copy Again") {
                                    viewModel.copyToClipboard(item)
                                }
                                Button("Delete", role: .destructive) {
                                    viewModel.delete(item)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Clipboard History")
            .toolbar {
                ToolbarItemGroup(placement: .primaryAction) {
                    Button("Clear All", role: .destructive) {
                        viewModel.clearAll()
                    }
                }
            }
        }
        .frame(minWidth: 720, minHeight: 480)
        .onAppear {
            viewModel.startMonitoring()
        }
        .onDisappear {
            viewModel.stopMonitoring()
        }
    }
}
