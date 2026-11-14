import type { BackgroundImage, ImageFit, SlideRender } from "../types";

export type SrcResolver = (src: string) => string;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

export type LayoutImageKind = "bg" | "left" | "right" | "center" | "normal";

export interface LayoutImageSpec {
  kind: LayoutImageKind;
  fit: ImageFit;
  width: number;
}

/**
 * Layout is encoded in the image alt text, so it stays valid markdown:
 *
 *   ![bg](assets/photo.jpg)          full-bleed background
 *   ![bg:contain](assets/logo.png)   fitted background
 *   ![right](assets/chart.png)       floated right (38% width)
 *   ![left:45%](assets/chart.png)    floated left at 45% width
 *   ![center:60%](assets/logo.png)   centered block image
 */
export function parseImageAlt(alt: string): LayoutImageSpec {
  const value = alt.trim().toLowerCase();
  const match = /^(bg|left|right|center)(?::([a-z]+|\d{1,3}%?))?$/.exec(value);
  if (!match) return { kind: "normal", fit: "cover", width: 100 };

  const kind = match[1] as LayoutImageKind;
  const arg = match[2];
  if (kind === "bg") {
    const fit: ImageFit = arg === "contain" ? "contain" : "cover";
    return { kind, fit, width: 100 };
  }

  let width = kind === "center" ? 60 : 38;
  if (arg) {
    const numeric = Number.parseFloat(arg.replace("%", ""));
    if (Number.isFinite(numeric)) width = Math.min(100, Math.max(10, numeric));
  }
  return { kind, fit: "cover", width };
}
