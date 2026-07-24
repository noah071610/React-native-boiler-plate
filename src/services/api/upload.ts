import { api } from '@/services/api/client';

type UploadKind = 'avatar' | 'thumbnail' | 'content';
type PresignResponse = { url: string; key: string };

/**
 * Upload a local file to R2 via a backend-issued presigned URL.
 * 1. Ask the backend for a presigned PUT URL + object key.
 * 2. PUT the file bytes straight to R2 (no AWS SDK).
 * 3. Return the object key for the caller to persist.
 */
export async function uploadFile(
  uri: string,
  mime: string,
  kind: UploadKind = 'content',
): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  const presignRes = await api.api.uploads.presign.$post({
    json: { kind, contentType: mime, size: blob.size },
  });
  if (!presignRes.ok) throw new Error(`presign failed: ${presignRes.status}`);
  const { url, key } = (await presignRes.json()) as PresignResponse;

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': mime },
    body: blob,
  });
  if (!putRes.ok) throw new Error(`R2 upload failed: ${putRes.status}`);

  return key;
}
