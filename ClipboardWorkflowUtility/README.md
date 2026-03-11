# Clipboard Workflow Utility

A Windows-first, local-first clipboard workflow app for repeated text work.

## Product direction
Build a role-specific clipboard workflow utility rather than a generic clipboard manager.

## Target platform
- Windows desktop first
- WPF + .NET 8 + C#
- Local-first persistence with SQLite
- No backend/auth/sync in v1
- Chrome is a later companion surface, not the core product

## MVP milestones
- M1: clipboard capture + local history
- M2: snippet library
- M3: global launcher + unified search
- M4: role-specific starter packs
- M5: privacy/polish/release hardening

## Current status
Windows-first architecture and M1 implementation scaffold created.

## Notes
This workspace currently lacks `dotnet`, so the WPF app cannot be built or run here. The code is structured to be opened on a Windows machine with the .NET desktop workload.
