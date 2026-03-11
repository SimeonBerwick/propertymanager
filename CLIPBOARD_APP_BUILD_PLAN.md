# Clipboard Workflow Utility - Build Plan

## Target platform and stack
- Platform: macOS desktop first
- UI: SwiftUI
- Language: Swift
- Persistence: SQLite via GRDB or SwiftData for speed
- Clipboard monitoring: NSPasteboard + changeCount polling
- Search: local indexed search over snippets and history
- Launcher/hotkeys: global shortcut integration
- Packaging: local-first desktop app, no backend, no auth, no sync in v1

## Architecture
Local-first single-user desktop app.

Core modules:
1. Clipboard Capture Service
- watches pasteboard
- stores text entries
- dedupes repeats
- applies retention rules

2. Snippet Library
- CRUD for saved snippets
- folders/tags
- pinned items

3. Unified Search Layer
- searches clipboard history + snippets
- ranks pinned/recent matches

4. Quick Launcher
- global hotkey opens compact command palette
- keyboard-first select -> copy back to clipboard

5. Privacy Controls
- pause capture
- clear history
- optional ignore rules later

## Data model
### ClipboardItem
- id
- text
- createdAt
- sourceApp optional
- pinned

### Snippet
- id
- title
- body
- folder
- tags
- pinned
- createdAt
- updatedAt
- useCount

## Milestone plan
### M1 - Core engine
- clipboard watcher
- local storage
- history list
- dedupe + delete + clear
- retention cap

### M2 - Snippet system
- create/edit/delete snippets
- pin snippets
- folders/tags
- search snippets

### M3 - Quick launcher
- global hotkey
- unified search across history + snippets
- keyboard navigation
- enter copies selected item

### M4 - Product wedge
- choose one role-specific preset pack
- onboarding for that role
- starter snippets/folders/templates

### M5 - Trust and polish
- pause capture
- privacy messaging
- empty states
- performance cleanup
- export/import if needed

## Biggest technical risks
- clipboard reliability
- sensitive data capture
- launcher UX quality
- fragile direct paste behavior
- overbuilding too early

## First build slice
Start with the smallest usable loop:
- macOS app shell
- clipboard watcher for text only
- persist last 100 clipboard items locally
- simple SwiftUI list of recent items
- tap item to copy it back to clipboard
- delete / clear history

Then add:
- saved snippets
- unified search
- global hotkey
