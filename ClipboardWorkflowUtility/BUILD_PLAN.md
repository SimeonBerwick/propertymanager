# Build Plan

## 1. Target platform and stack
- Platform: macOS 14+
- UI: SwiftUI
- Language: Swift 5.10+
- Persistence: SQLite via GRDB (preferred for control) or SwiftData (acceptable for speed)
- Clipboard monitoring: NSPasteboard with `changeCount`
- Global hotkey: HotKey or equivalent wrapper around Carbon shortcuts
- Packaging: local-only desktop app, no backend in v1

## 2. Architecture

### Modules
- `AppCore`: app lifecycle and dependency container
- `ClipboardCapture`: watches clipboard and emits text changes
- `Persistence`: stores clipboard items and snippets
- `History`: history list and retention rules
- `Snippets`: saved snippets, folders, tags, pinning
- `Launcher`: quick access search panel and keyboard-first actions
- `Privacy`: pause capture, clear history, retention settings

### Data model
- `ClipboardItem`
  - `id: UUID`
  - `text: String`
  - `createdAt: Date`
  - `sourceAppBundleID: String?`
  - `pinned: Bool`
- `Snippet`
  - `id: UUID`
  - `title: String`
  - `body: String`
  - `folder: String?`
  - `tags: [String]`
  - `pinned: Bool`
  - `createdAt: Date`
  - `updatedAt: Date`
  - `useCount: Int`

## 3. Milestones

### M1 — Core engine
- text clipboard watcher
- dedupe repeats
- local persistence
- recent history list
- delete/clear actions
- retention cap

### M2 — Snippet system
- create/edit/delete snippets
- folders or tags
- pin snippets
- search snippets
- save history item as snippet

### M3 — Quick launcher
- global hotkey
- unified search over history + snippets
- keyboard-first selection
- enter copies selected item back to clipboard

### M4 — Role-specific wedge
- choose target role
- starter folders/snippets/templates
- onboarding copy and seed data

### M5 — Release hardening
- pause capture
- privacy controls
- ignore sensitive sources where possible
- import/export
- app settings and release checklist

## 4. Biggest technical risks
- clipboard monitoring reliability
- accidental sensitive-data capture
- launcher latency/UX quality
- fragile direct-paste automation
- category drift into a generic clipboard app

## 5. First build slice
Implement the smallest usable loop:
- clipboard monitor for plain text
- persist last 100 items
- render recent history in SwiftUI
- tap/click to copy item back to clipboard
- delete and clear history
