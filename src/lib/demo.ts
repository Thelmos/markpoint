import type { ProjectData } from "../types";
import { textToBytes } from "./assets";
import { createManifest, DEFAULT_MARKDOWN_FILE } from "./project";

const backgroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7f5ef"/>
      <stop offset="0.55" stop-color="#eef4fb"/>
      <stop offset="1" stop-color="#e7ecf9"/>
    </linearGradient>
    <linearGradient id="blob" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6ea8ff" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#8b5cf6" stop-opacity="0.08"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#bg)"/>
  <circle cx="1290" cy="120" r="420" fill="url(#blob)"/>
  <circle cx="240" cy="820" r="360" fill="url(#blob)" opacity="0.55"/>
  <path d="M0 720 C 320 620, 520 860, 860 740 S 1360 640, 1600 760" fill="none" stroke="#2563eb" stroke-opacity="0.12" stroke-width="3"/>
  <path d="M0 760 C 320 660, 520 900, 860 780 S 1360 680, 1600 800" fill="none" stroke="#2563eb" stroke-opacity="0.08" stroke-width="2"/>
</svg>`;

const figureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="620" viewBox="0 0 760 620">
  <defs>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#17233c"/>
      <stop offset="1" stop-color="#0d1424"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6ea8ff"/>
      <stop offset="1" stop-color="#a78bfa"/>
    </linearGradient>
  </defs>
  <rect width="760" height="620" rx="36" fill="url(#card)"/>
  <rect x="56" y="66" width="300" height="22" rx="11" fill="#2b3a59"/>
  <rect x="56" y="112" width="480" height="14" rx="7" fill="#22304b"/>
  <rect x="56" y="146" width="404" height="14" rx="7" fill="#22304b"/>
  <rect x="56" y="214" width="648" height="2" fill="#263553"/>
  <g font-family="Segoe UI, system-ui, sans-serif">
    <text x="56" y="300" fill="#eaf0fb" font-size="64" font-weight="700">MarkPoint</text>
    <text x="58" y="346" fill="#8fa4c6" font-size="24">markdown → diapositivas</text>
  </g>
  <rect x="56" y="402" width="176" height="48" rx="24" fill="url(#accent)"/>
  <text x="88" y="433" fill="#0c1526" font-family="Segoe UI, system-ui, sans-serif" font-size="20" font-weight="700">F5 para presentar</text>
  <g fill="none" stroke="#31456b" stroke-width="2">
    <rect x="56" y="500" width="180" height="74" rx="16"/>
    <rect x="262" y="500" width="180" height="74" rx="16"/>
    <rect x="468" y="500" width="236" height="74" rx="16"/>
  </g>
  <circle cx="628" cy="118" r="34" fill="#6ea8ff" opacity="0.18"/>
  <circle cx="628" cy="118" r="12" fill="url(#accent)"/>
</svg>`;

export const DEMO_MARKDOWN = `---
title: Presentación de ejemplo
author: MarkPoint
paginate: true
---

![bg](assets/background.svg)

# MarkPoint

Presentaciones **rápidas** desde Markdown

Escribe a la izquierda · previsualiza a la derecha

<!-- notes: Esta es la diapositiva de bienvenida. Pulsa F5 para presentar y Escape para salir. -->

---

## Una diapositiva se escribe en segundos

- Separa diapositivas con \`---\`
- El texto se ajusta solo al espacio disponible
- Las imágenes admiten fondo y alineación desde el texto alternativo

![right:36%](assets/figure.svg)

Puedes seguir escribiendo alrededor de la imagen: el texto fluye a su izquierda.

<!-- notes: La imagen se coloca a la derecha usando ![right:36%](ruta). -->

---

## Todo lo que esperas de Markdown

| Elemento | Soporte |
| --- | --- |
| Tablas, listas y citas | ✅ |
| Código resaltado | ✅ |
| Fórmulas con KaTeX | ✅ |
| Diagramas Mermaid | ✅ |
| Emojis :rocket: | ✅ |

> El tamaño de letra se calcula por diapositiva, no por número de líneas.

---

## Código y matemáticas

\`\`\`ts
export function fit(slide: HTMLElement) {
  // reduce el tamaño hasta que el contenido encaja
  return binarySearch(slide, 13, 74);
}
\`\`\`

La identidad de Euler: $e^{i\\pi} + 1 = 0$

$$\\int_{0}^{1} x^2\\,dx = \\frac{1}{3}$$

---

## Diagramas

\`\`\`mermaid
flowchart LR
  A[Markdown] --> B[Parsear diapositivas]
  B --> C[Renderizar]
  C --> D{Ajuste de texto}
  D --> E[Vista previa]
  D --> F[Presentación]
\`\`\`

---

## Maquetación con imágenes

![center:52%](assets/figure.svg)

Escribe \`![bg](fondo.jpg)\` para un fondo a pantalla completa, o \`![left:40%](imagen.png)\` para flotar a la izquierda.

<!-- notes: Cierra con la idea de que el markdown sigue siendo markdown. -->
`;

export function createDemoProject(): ProjectData {
  const files = new Map<string, Uint8Array>();
  files.set("assets/background.svg", textToBytes(backgroundSvg));
  files.set("assets/figure.svg", textToBytes(figureSvg));
  return {
    markdownPath: DEFAULT_MARKDOWN_FILE,
    markdown: DEMO_MARKDOWN,
    manifest: createManifest("Presentación de ejemplo", "light"),
    files,
  };
}

