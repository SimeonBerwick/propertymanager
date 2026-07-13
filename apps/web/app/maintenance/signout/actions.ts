'use server'
import { redirect } from 'next/navigation'
import { clearStaffSession } from '@/lib/staff-auth'
export async function signOutStaffAction() { await clearStaffSession(); redirect('/login') }
