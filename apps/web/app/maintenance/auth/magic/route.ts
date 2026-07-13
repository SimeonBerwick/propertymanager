import { NextRequest, NextResponse } from 'next/server'
import { createStaffSession, verifyStaffOtp } from '@/lib/staff-auth'
export async function GET(request: NextRequest) { const url = new URL(request.url); const staffId = await verifyStaffOtp(url.searchParams.get('challengeId') ?? '', url.searchParams.get('code') ?? ''); if (!staffId) return NextResponse.redirect(new URL('/maintenance/auth/login?error=magic-link', request.url)); await createStaffSession(staffId); return NextResponse.redirect(new URL('/maintenance', request.url)) }
