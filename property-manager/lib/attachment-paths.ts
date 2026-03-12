export function getAttachmentUrl(storagePath: string) {
  if (!storagePath) return '';
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  return storagePath.startsWith('/') ? storagePath : `/${storagePath}`;
}
