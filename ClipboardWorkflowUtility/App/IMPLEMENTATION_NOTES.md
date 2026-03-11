# Implementation Notes

## M1 delivered in scaffold form
- Clipboard monitor based on `NSPasteboard.changeCount`
- In-memory repository with dedupe + retention cap hook
- History view model
- SwiftUI history list
- Copy-again action
- Delete / clear all
- Pause capture toggle

## What remains before M1 is production-ready
1. Replace in-memory repository with SQLite/GRDB-backed persistence
2. Add app settings persistence
3. Add tests for dedupe and retention behavior
4. Validate monitoring behavior on real macOS host
5. Add basic app icon/signing/release metadata

## Suggested next technical move
Implement a GRDB-backed `ClipboardRepository` and keep the current protocol boundary unchanged.
