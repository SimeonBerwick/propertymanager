'use client'

export function ActionFeedback({
  error,
  success,
  detail,
  onUndo,
}: {
  error?: string | null
  success?: string | null | false
  detail?: string
  onUndo?: () => void
}) {
  if (error) return <div className="actionFeedback actionFeedbackError" role="alert"><strong>Could not complete action</strong><span>{error}</span></div>
  if (!success) return null

  return <div className="actionFeedback actionFeedbackSuccess" role="status">
    <div><strong>Done</strong><span>{success}{detail ? ` ${detail}` : ''}</span></div>
    {onUndo ? <button type="button" onClick={onUndo}>Undo</button> : null}
  </div>
}
