import { textToBytes } from "./assets.ts";

/**
 * Template shipped with the app. It is seeded into the user's template folder
 * once, so it behaves like any other template afterwards.
 */
const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbfaf7"/>
      <stop offset="0.58" stop-color="#f3f6fb"/>
      <stop offset="1" stop-color="#e8eef9"/>
    </linearGradient>
    <linearGradient id="blue" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563eb" stop-opacity="0.30"/>
      <stop offset="1" stop-color="#7c3aed" stop-opacity="0.10"/>
    </linearGradient>
    <linearGradient id="violet" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#7c3aed" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#2563eb" stop-opacity="0.04"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#paper)"/>
  <circle cx="1360" cy="110" r="440" fill="url(#blue)"/>
  <circle cx="1180" cy="760" r="330" fill="url(#violet)"/>
  <g fill="none" stroke="#2563eb" stroke-opacity="0.16" stroke-width="2">
    <path d="M0 690 C 330 610, 560 790, 880 700 S 1330 600, 1600 700"/>
    <path d="M0 740 C 330 660, 560 840, 880 750 S 1330 650, 1600 750"/>
    <circle cx="1360" cy="110" r="308"/>
    <circle cx="1360" cy="110" r="186"/>
  </g>
  <g fill="#2563eb" fill-opacity="0.16">
    <circle cx="120" cy="130" r="7"/>
    <circle cx="158" cy="130" r="7"/>
    <circle cx="196" cy="130" r="7"/>
  </g>
  <g font-family="Segoe UI, system-ui, sans-serif" fill="#1b2430" fill-opacity="0.34">
    <text x="120" y="792" font-size="19" letter-spacing="4">MARKPOINT</text>
  </g>
</svg>`;

const section = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fbfaf7"/>
      <stop offset="0.62" stop-color="#f7f8fb"/>
      <stop offset="1" stop-color="#edf2fa"/>
    </linearGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563eb" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#7c3aed" stop-opacity="0.08"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#paper)"/>
  <circle cx="1390" cy="450" r="360" fill="url(#ring)"/>
  <g fill="none" stroke="#2563eb" stroke-opacity="0.15" stroke-width="2">
    <circle cx="1390" cy="450" r="250"/>
    <circle cx="1390" cy="450" r="140"/>
    <path d="M1080 118 H1500 M1080 782 H1500"/>
  </g>
  <g fill="#7c3aed" fill-opacity="0.14">
    <rect x="1080" y="690" width="34" height="34" rx="8"/>
    <rect x="1130" y="690" width="34" height="34" rx="8"/>
    <rect x="1180" y="690" width="34" height="34" rx="8"/>
  </g>
</svg>`;

const content1c = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbfaf7"/>
      <stop offset="0.7" stop-color="#f7f8fb"/>
      <stop offset="1" stop-color="#eef3fb"/>
    </linearGradient>
    <linearGradient id="corner" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563eb" stop-opacity="0.20"/>
      <stop offset="1" stop-color="#7c3aed" stop-opacity="0.04"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#paper)"/>
  <path d="M1600 0 H1090 C1270 110, 1400 250, 1600 360 Z" fill="url(#corner)"/>
  <g fill="none" stroke="#2563eb" stroke-opacity="0.14" stroke-width="2">
    <path d="M1600 145 H1180 M1600 235 H1290 M1600 325 H1390"/>
    <path d="M0 790 H180 M0 830 H120"/>
  </g>
  <g fill="#7c3aed" fill-opacity="0.18">
    <circle cx="72" cy="72" r="6"/>
    <circle cx="108" cy="72" r="6"/>
    <circle cx="144" cy="72" r="6"/>
  </g>
</svg>`;

const content2c = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbfaf7"/>
      <stop offset="0.5" stop-color="#f8f9fc"/>
      <stop offset="1" stop-color="#eef3fb"/>
    </linearGradient>
    <linearGradient id="left" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#2563eb" stop-opacity="0.13"/>
      <stop offset="1" stop-color="#2563eb" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="right" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0" stop-color="#7c3aed" stop-opacity="0.11"/>
      <stop offset="1" stop-color="#7c3aed" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#paper)"/>
  <rect width="250" height="900" fill="url(#left)"/>
  <rect x="1350" width="250" height="900" fill="url(#right)"/>
  <g fill="none" stroke="#2563eb" stroke-opacity="0.12" stroke-width="2">
    <path d="M0 96 H240 M1360 96 H1600"/>
    <path d="M0 804 H240 M1360 804 H1600"/>
  </g>
  <g fill="#2563eb" fill-opacity="0.16">
    <circle cx="72" cy="780" r="6"/>
    <circle cx="108" cy="780" r="6"/>
  </g>
  <g fill="#7c3aed" fill-opacity="0.16">
    <circle cx="1492" cy="780" r="6"/>
    <circle cx="1528" cy="780" r="6"/>
  </g>
</svg>`;

export const BUILTIN_TEMPLATE = {
  id: "editorial",
  name: "Editorial",
  description:
    "Fondo crema con acentos azules y violetas, cuatro diapositivas de ejemplo y diseños de sección, una columna y dos columnas.",
  themeYaml: `name: Editorial
description: Fondo crema con acentos azules y violetas, cuatro diapositivas de ejemplo y diseños de sección, una columna y dos columnas.
base: light
bg: "#fbfaf7"
fg: "#1b2430"
muted: "#5d6b7e"
accent: "#2563eb"
accent2: "#7c3aed"
border: "#dbe2ec"
scrim: "rgba(251, 250, 247, 0.28)"
padX: 96
padY: 78
`,
  example: `---
title: Editorial
paginate: true
---

<!-- layout: section -->

![bg](cover.svg)

# Escribe el título

Una plantilla lista para adaptar a tu contenido.

---

<!-- layout: section -->

![bg](section.svg)

# Sección

Texto de apoyo para separar bloques.

---

<!-- layout: content-1c -->

![bg](content-1c.svg)

## Contenido en una columna

- Una idea principal
- Un detalle que la acompaña
- Un cierre claro

---

<!-- layout: content-2c -->

![bg](content-2c.svg)

## Dos columnas

El cuerpo se reparte automáticamente entre las dos columnas.

Puedes añadir imágenes, código o diagramas y el texto buscará su columna.
`,
  arts: {
    cover: textToBytes(cover),
    section: textToBytes(section),
    "content-1c": textToBytes(content1c),
    "content-2c": textToBytes(content2c),
  } as Record<string, Uint8Array>,
  fonts: [] as Array<{ path: string; bytes: Uint8Array }>,
};
