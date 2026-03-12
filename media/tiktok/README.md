# TikTok Media Workflow

## Mode
- Login method: already-logged-in browser sessions
- Password policy: keep passwords out of workspace files
- Browser mode: persistent ACP/browser session for media work

## Folder layout
- `scripts/` — final approved scripts
- `prompts/` — Kling/Suno prompt files
- `audio/` — generated music and audio assets
- `video/` — generated video assets
- `final/` — final export-ready or exported reels

## Workflow
1. Mario chooses topic and script
2. Prompt package is created
3. Media session uses logged-in browser sessions when available
4. Assets are saved back into this folder tree
5. CapCut finishing pass assembles final reel
6. Final output is stored in `final/`
