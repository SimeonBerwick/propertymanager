# First Build Slice

## Goal
Get to the first end-to-end internal build as fast as possible.

## Build slice
1. Create web app scaffold
2. Add auth shell
3. Add photo upload page
4. Persist uploaded photo records in Postgres
5. Create generation job table/status model
6. Add style preset selection
7. Add fake/mock generation worker first
8. Render job status and placeholder variants

## Why this first
This proves the full app shape before model tuning.
The first testable truth is not image quality yet; it is whether the workflow from upload to staged-results page is clean and stable.

## Immediate next slice after that
Replace mock worker with real image-edit model API integration for one room type and one style preset.
