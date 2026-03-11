# Realtor Aid - Build Plan

## 1. Target platform / stack
- Frontend: Next.js + TypeScript
- Backend: Next.js route handlers + background worker (Node or Python)
- Storage: S3 or Cloudflare R2
- Database: Postgres
- ORM: Prisma
- Auth: Clerk or Supabase Auth
- Jobs: background queue for image processing
- Model layer: external image edit / inpainting APIs first
- Hosting: Vercel for web + managed Postgres + worker host

## 2. MVP architecture

### Frontend surfaces
- Upload page
- Generation job status page
- Result review page
- Export/download flow
- Admin/internal QA page later

### Backend services
- Auth service
- Image upload service
- Job creation API
- Generation worker
- Result storage
- Audit/event logging

### Core generation pipeline
1. user uploads listing photo
2. user selects room type
3. user selects style preset
4. system stores original image and creates generation job
5. worker sends image + structured prompt to image-edit model
6. worker stores 3-4 variants
7. app returns staged results for review and export

### V1 constraints
- interiors only
- empty or mostly empty rooms only
- living room + bedroom only
- no occupied-room cleanup workflow
- no mobile app initially
- no self-hosted model infra

## 3. Initial data model
- User
- Project
- Photo
- GenerationJob
- GenerationVariant
- StylePreset
- ExportRecord

## 4. Risks
- geometry/perspective failures
- room identity drift
- lighting mismatch
- low acceptance rate from realtors
- output inconsistency across homes
- compliance/disclosure workflow if not handled clearly

## 5. Success metric for first build
Jeff should be able to upload an empty-room listing photo, choose a style, receive multiple staged variants, and judge whether at least one is usable in a listing workflow.
