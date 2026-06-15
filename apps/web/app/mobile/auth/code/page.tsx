import { redirect } from 'next/navigation'

export default function TenantAccessCodePage() {
  redirect('/mobile/auth/login' as never)
}
