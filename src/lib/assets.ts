const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
};

export function extensionOf(path: string): string {
  const clean = path.split(/[?#]/)[0];
  const dot = clean.lastIndexOf(".");
  return dot === -1 ? "" : clean.slice(dot + 1).toLowerCase();
}

export function mimeOf(path: string): string {
  return MIME[extensionOf(path)] ?? "application/octet-stream";
}

export function isImagePath(path: string): boolean {
  return extensionOf(path) in MIME && mimeOf(path).startsWith("image/");
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

export function fileToDataUrl(bytes: Uint8Array, path: string): string {
  return bytesToDataUrl(bytes, mimeOf(path));
}

export function bytesToBlobUrl(bytes: Uint8Array, path: string): string {
  return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mimeOf(path) }));
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

export function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function sanitizeFileName(name: string, fallback = "presentation"): string {
  const clean = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "");
  return clean || fallback;
}

export function uniqueAssetPath(existing: Map<string, unknown>, fileName: string): string {
  const safe = sanitizeFileName(fileName, "image");
  const dot = safe.lastIndexOf(".");
  const base = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : "";
  let candidate = `assets/${safe}`;
  let n = 1;
  while (existing.has(candidate)) {
    candidate = `assets/${base}-${n}${ext}`;
    n += 1;
  }
  return candidate;
}
