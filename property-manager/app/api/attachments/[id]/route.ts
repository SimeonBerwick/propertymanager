/**
 * Authorized attachment proxy.
 *
 * GET /api/attachments/:id
 *
 * Accepts either a web session (pm_session) or a mobile tenant session
 * (pm_mobile_session). Access rules:
 *   Operator  — must be in the same org as the request's property
 *   Tenant    — must own the request and isTenantVisible must be true
 *   Vendor    — must be the assigned vendor and isVendorVisible must be true
 *   Mobile tenant — same as Tenant, resolved from pm_mobile_session cookie
 *
 * Files are fetched from the configured storage backend (local or R2) and
 * streamed back with the original MIME type. This keeps attachment URLs
 * same-origin and avoids exposing storage credentials or bucket structure to
 * the browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getTenantMobileSession } from '@/lib/tenant-mobile-session';
import { storageGet } from '@/lib/storage';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // ── Authentication ──────────────────────────────────────────────────────────
  // Try web session first, then fall back to mobile tenant session.
  const session = await getSession();
  const mobileSession = session ? null : await getTenantMobileSession();

  if (!session && !mobileSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Load attachment with enough context for access checks ───────────────────
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      id: true,
      storagePath: true,
      mimeType: true,
      request: {
        select: {
          tenantId: true,
          assignedVendorId: true,
          isTenantVisible: true,
          isVendorVisible: true,
          property: { select: { organizationId: true } },
        },
      },
    },
  });

  if (!attachment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // ── Authorization ───────────────────────────────────────────────────────────
  const req = attachment.request;
  let allowed = false;

  if (session) {
    if (session.role === 'operator' && session.organizationId) {
      allowed = req.property.organizationId === session.organizationId;
    } else if (session.role === 'tenant' && session.tenantId) {
      allowed = req.tenantId === session.tenantId && req.isTenantVisible;
    } else if (session.role === 'vendor' && session.vendorId) {
      allowed = req.assignedVendorId === session.vendorId && req.isVendorVisible;
    }
  } else if (mobileSession) {
    // Mobile tenants may only access tenant-visible attachments on their own requests.
    // tenantId is derived from the DB-backed session — never from client input.
    allowed = req.tenantId === mobileSession.tenantId && req.isTenantVisible;
  }

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Fetch from storage ──────────────────────────────────────────────────────
  const buffer = await storageGet(attachment.storagePath);
  if (!buffer) {
    return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Length': String(buffer.byteLength),
      // Prevent the browser from caching authenticated file responses across sessions
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
