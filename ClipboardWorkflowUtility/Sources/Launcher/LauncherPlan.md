# Launcher Plan (M3)

## Goal
Open a command-palette style window via global hotkey and search across clipboard history plus snippets.

## Technical shape
- Register a global hotkey
- Show a small floating panel
- Search local indexed data
- Keyboard-only navigation
- Enter copies selected result to clipboard

## Result ranking
1. pinned snippets
2. exact title/body match
3. recent clipboard entries
4. snippet use-count bias

## Constraints
Keep direct paste automation out of v1. Copy-back is safer and less fragile.
