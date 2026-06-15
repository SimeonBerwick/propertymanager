'use client'

import { useEffect, useState } from 'react'

export function ResendCodeForm({
  action,
  challengeId,
  next,
}: {
  action: (formData: FormData) => void | Promise<void>
  challengeId: string
  next?: string
}) {
  const [seconds, setSeconds] = useState(30)

  useEffect(() => {
    if (seconds <= 0) return
    const timer = window.setTimeout(() => setSeconds(seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [seconds])

  return (
    <form action={action}>
      <input type="hidden" name="challengeId" value={challengeId} />
      <input type="hidden" name="next" value={next ?? ''} />
      <button type="submit" className="button" disabled={seconds > 0}>
        {seconds > 0 ? `Resend code in ${seconds}s` : 'Resend code'}
      </button>
    </form>
  )
}
