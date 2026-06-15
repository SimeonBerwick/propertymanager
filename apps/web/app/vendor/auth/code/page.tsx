import { redirect } from 'next/navigation'

export default function VendorAccessCodePage() {
  redirect('/vendor/auth/login' as never)
}
