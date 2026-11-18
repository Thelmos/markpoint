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
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
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

export function isFontPath(path: string): boolean {
  return extensionOf(path) in MIME && mimeOf(path).startsWith("font/");
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

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
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

/**
 * Asset names end up inside Markdown image destinations, so whitespace and
 * URL-significant characters are replaced with dashes. Otherwise a picture
 * called "my photo.png" would produce `![](assets/my photo.png)`, which is not
 * a valid Markdown link.
 */
export function sanitizeAssetName(name: string): string {
  const clean = sanitizeFileName(name, "image");
  const dot = clean.lastIndexOf(".");
  const base = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : "";
  const safe = base
    .replace(/[\s#%]+/g, "-")
    .replace(/[()[\]]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return `${safe || "image"}${ext}`;
}

/** Percent-encodes each path segment so the reference is valid Markdown. */
export function encodeAssetPath(path: string): string {
  return path
    .split("/")
    .map((segment) =>
      encodeURIComponent(segment).replace(/[()]/g, (char) =>
        char === "(" ? "%28" : "%29",
      ),
    )
    .join("/");
}

export function uniqueAssetPath(existing: Map<string, unknown>, fileName: string): string {
  const safe = sanitizeAssetName(fileName);
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

/** Bundled fonts live under `assets/fonts`, like any other project asset. */
export function uniqueFontPath(existing: Map<string, unknown>, fileName: string): string {
  const safe = sanitizeAssetName(fileName);
  const dot = safe.lastIndexOf(".");
  const base = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : ".woff2";
  let candidate = `assets/fonts/${base}${ext}`;
  let n = 1;
  while (existing.has(candidate)) {
    candidate = `assets/fonts/${base}-${n}${ext}`;
    n += 1;
  }
  return candidate;
}

/** Reuses an existing font with the same name before creating a copy. */
export function fontAssetPath(existing: Map<string, unknown>, fileName: string): string {
  const candidate = `assets/fonts/${sanitizeAssetName(fileName)}`;
  return existing.has(candidate) ? candidate : uniqueFontPath(existing, fileName);
}
