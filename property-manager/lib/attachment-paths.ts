/**
 * Returns the URL for accessing an attachment by its database ID.
 * All attachment requests are routed through the authorized proxy at
 * /api/attachments/:id, which enforces session-based access control before
 * returning file bytes. No attachment bytes are ever served as raw public URLs.
 */
export function getAttachmentUrl(attachmentId: string): string {
  return `/api/attachments/${attachmentId}`;
}
