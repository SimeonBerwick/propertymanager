# Windows Implementation Notes

## M1 delivered in scaffold form
- WPF app shell
- App startup wiring
- clipboard polling service for text capture
- SQLite-backed repository skeleton using `Microsoft.Data.Sqlite`
- history view model
- recent history window
- copy / delete / clear loop
- retention limit of 100 via settings

## What remains before M1 is actually usable
1. Build and validate on a Windows machine with .NET desktop workload
2. Confirm clipboard polling behavior and thread safety
3. Optionally replace polling with `AddClipboardFormatListener` for stronger event-based capture
4. Add source-app detection if needed
5. Add local settings persistence

## Technical truth
The current code is implementation-grade scaffold, not runtime-validated product code. The blocker is environment, not direction.
