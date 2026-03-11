# Build Plan

## 1. Target platform and stack
- Platform: Windows 11+
- UI: WPF
- Language: C# / .NET 8
- Persistence: SQLite
- Clipboard monitoring: Win32 `AddClipboardFormatListener`
- Global hotkey: Win32 global hotkey registration
- Search: SQLite FTS later, in-memory filtering first
- Packaging: local desktop app; installer later

## 2. Architecture

### Modules
- `App`: WPF shell and lifecycle
- `ClipboardCapture`: clipboard listener window/service
- `Persistence`: SQLite repository for history/snippets
- `History`: recent clipboard history and replay loop
- `Snippets`: saved snippets, folders, tags, pinning
- `Launcher`: quick access window with search
- `Privacy`: pause capture, clear history, retention settings

### Data model
- `ClipboardItem`
  - `Id: Guid`
  - `Text: string`
  - `CreatedAtUtc: DateTime`
  - `SourceApp: string?`
  - `Pinned: bool`
- `Snippet`
  - `Id: Guid`
  - `Title: string`
  - `Body: string`
  - `Folder: string?`
  - `Tags: string`
  - `Pinned: bool`
  - `CreatedAtUtc: DateTime`
  - `UpdatedAtUtc: DateTime`
  - `UseCount: int`

## 3. Milestones

### M1 — Core engine
- WPF app shell
- text clipboard listener
- SQLite-backed history persistence
- dedupe repeats
- recent history list
- click to copy back to clipboard
- clear/delete actions
- retention cap of 100 items

### M2 — Snippet system
- create/edit/delete snippets
- folders or tags
- pin snippets
- save history item as snippet
- search snippets

### M3 — Quick launcher
- global hotkey
- unified search over history + snippets
- keyboard-first selection
- enter copies selected item

### M4 — Role-specific wedge
- choose target role
- starter folders/snippets/templates
- onboarding copy and seed data

### M5 — Release hardening
- pause capture
- privacy controls
- ignore sensitive sources where possible
- import/export
- installer/signing/release checklist

## 4. Biggest technical risks
- clipboard listener reliability across app focus changes
- accidental sensitive-data capture
- launcher latency/UX quality
- direct-paste automation complexity
- drifting back into a generic clipboard app

## 5. First build slice
Implement the smallest usable Windows loop:
- WPF shell
- clipboard listener for plain text
- persist last 100 items in SQLite
- render recent history list
- click item to copy it back to clipboard
- delete and clear history
- pause capture toggle
