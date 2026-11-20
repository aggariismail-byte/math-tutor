export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const UPLOAD_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

export const UPLOAD_ACCEPT = UPLOAD_TYPES.join(",");

/** Why a file can't be attached, or null when it can. */
export function uploadProblem(file: { type: string; size: number }): string | null {
  if (!(UPLOAD_TYPES as readonly string[]).includes(file.type)) {
    return "Attach a PNG, JPEG, WebP or PDF file.";
  }
  if (file.size > MAX_UPLOAD_BYTES) return "Files can be up to 10 MB.";
  if (file.size === 0) return "That file is empty.";
  return null;
}
