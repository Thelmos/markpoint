<p align="center">
  <img src="src-tauri/icons/icon.png" alt="Logo de MarkPoint" width="128" height="128">
</p>

<p align="center">
  <img src="docs/brand/markpoint-wordmark.svg" alt="MarkPoint" width="360">
</p>

Aplicación de escritorio para crear presentaciones de diapositivas a partir de **Markdown**, con vista previa en vivo, autoajuste de texto, maquetación con imágenes, temas, notas del orador y modo presentación.

- **Stack:** Tauri 2 (Rust + WebView2) · React 19 · TypeScript · Vite · CodeMirror 6 · markdown-it.
- **Windows:** binario ligero (~unos pocos MB) y sin runtime de Node embebido.
- **Multiplataforma:** el mismo código compila para macOS y Linux con Tauri; solo cambia el empaquetado. La exportación a PDF usa Edge/Chrome en modo headless, por lo que en macOS/Linux requiere Chrome/Chromium instalado (o se puede adaptar a otro motor).
- **Vista de presentador:** si hay un segundo monitor, MarkPoint crea automáticamente una ventana de audiencia a pantalla completa en él y muestra en la ventana principal la diapositiva actual, la siguiente, las notas y el cronómetro. Con un solo monitor se usa el modo de pantalla completa tradicional.

## Desarrollo

Requisitos: Node.js 20+, Rust estable, Microsoft Edge WebView2 y Visual Studio Build Tools (C++).

```bash
npm install
npm run tauri dev      # app de escritorio en modo desarrollo
npm run tauri build    # instalador NSIS en src-tauri/target/release/bundle/nsis
```

El instalador registra la asociación `.markpoint` y una sola instancia de la aplicación. La app también acepta una ruta de archivo como argumento (`markpoint.exe "presentacion.markpoint"`), que es lo que usa el doble clic.

En Windows el empaquetado se limita a NSIS mediante `src-tauri/tauri.windows.conf.json`; en macOS/Linux Tauri usará sus formatos nativos. También se puede probar solo la interfaz web con `npm run dev` (los diálogos nativos y el PDF usan alternativas del navegador).

## Uso

1. Escribe Markdown en el panel izquierdo.
2. Cada diapositiva se separa con una línea `---`.
3. El panel derecho muestra todas las diapositivas. Al mover el cursor o hacer scroll en el editor, la lista se centra en la diapositiva correspondiente; al hacer scroll o clic en una diapositiva, el editor salta a su línea.
4. `F5` entra en modo presentación. `Espacio` / `→` avanzan, `←` retrocede, `N` muestra notas (modo de un monitor), `T` oculta el temporizador, `P` lo pausa y `Esc` sale.
5. `Ctrl+S` guarda, `Ctrl+Shift+S` guarda como, `Ctrl+O` abre y `Ctrl+N` crea una presentación.
6. Al pulsar con el botón derecho sobre el texto del editor aparece un menú contextual: **Insertar imagen…** está siempre disponible; **Negrita**, **Cursiva** y los **títulos 1–3** se activan cuando hay texto seleccionado y aplican el formato a la selección.
7. El botón **?** de la barra superior abre una ayuda con la sintaxis esencial del editor: diapositivas, texto, imágenes, notas del orador, Markdown adicional y atajos.
8. El botón del reloj, junto a Abrir, muestra los **archivos recientes**. Los proyectos con archivo se **autoguardan** ~1,2 s después del último cambio; los que aún no tienen ruta guardan una **copia de recuperación** y, al volver a abrir la app, ofrecen restaurarla.

Al instalar MarkPoint en Windows, los archivos `.markpoint` quedan asociados a la aplicación: se pueden abrir con doble clic. Si la app ya está abierta, la nueva apertura se reenvía a la misma ventana (instancia única).

## Sintaxis de las diapositivas

### Front matter (opcional)

```markdown
---
title: Mi presentación
author: Ada Lovelace
paginate: true
---
```

`paginate: false` oculta los números de página.

### Separación

```markdown
# Diapositiva 1

Contenido

---

# Diapositiva 2
```

Los `---` dentro de bloques de código cercados no separan diapositivas.

### Notas del orador

```markdown
Contenido visible

<!-- notes: Solo lo ve el presentador. Puede ocupar varias líneas. -->
```

### Imágenes y maquetación

La posición se define en el **texto alternativo** de la imagen, de modo que el Markdown sigue siendo válido:

| Sintaxis | Resultado |
| --- | --- |
| `![bg](assets/fondo.jpg)` | Fondo a pantalla completa (cover) |
| `![bg:contain](assets/logo.png)` | Fondo ajustado sin recortar |
| `![left](assets/grafico.png)` | Imagen flotada a la izquierda (38 %) |
| `![left:45%](assets/grafico.png)` | Flotada a la izquierda con un tamaño máximo del 45 % |
| `![right:36%](assets/grafico.png)` | Flotada a la derecha con un tamaño máximo del 36 % |
| `![center:60%](assets/logo.png)` | Imagen centrada con un tamaño máximo del 60 % |
| `![texto normal](foto.png)` | Imagen normal en línea |

- Las rutas son relativas al proyecto (normalmente `assets/...`).
- Se puede arrastrar y soltar una imagen sobre la ventana para copiarla al proyecto e insertarla en el cursor, o usar **Insertar imagen…** en el menú contextual del editor. Los nombres se sanean (espacios y caracteres especiales pasan a `-`) para que la referencia sea Markdown válido.
- El porcentaje limita el tamaño respecto al área de contenido: las imágenes apaisadas crecen en ancho y las verticales en alto, sin deformarse ni dejar franjas.
- Las imágenes `left` y `right` se anclan debajo del título de la diapositiva: el título se dibuja a todo el ancho y, después, el texto fluye al lado de la imagen y continúa a todo el ancho por debajo de ella.
- El fondo lleva un velo automático según el tema para mantener la legibilidad del texto.
- Al guardar se eliminan del `.markpoint` las imágenes que ya no se referencian en el Markdown, para liberar espacio. Se conservan en memoria durante la sesión.

### Markdown compatible

- Títulos, listas, tablas GFM, citas, enlaces, tachado, listas de tareas.
- Bloques de código con resaltado (lenguaje tras las tres comillas).
- Fórmulas KaTeX: `$e^{i\pi}+1=0$` y bloques `$$ ... $$`.
- Diagramas Mermaid con un bloque ` ```mermaid `.
- Emojis `:rocket:`.

### Temas

Claro, Oscuro, Océano y Arena, seleccionables desde la barra superior. El tema forma parte del proyecto y se guarda en `manifest.json`.

## Formato de archivo

Una presentación se guarda como un único archivo `.markpoint`, que es un ZIP con:

```
manifest.json       # título, tema, versión y fechas
presentation.md     # contenido Markdown
assets/...          # imágenes y recursos
```

También se puede abrir un `.md` suelto; al guardarlo se convierte en `.markpoint`. Las imágenes referenciadas junto a un `.md` suelto no se empaquetan automáticamente.

## Exportación

- **HTML autónomo:** un solo archivo con las diapositivas, imágenes incrustadas en base64, fuentes KaTeX incluidas, diagramas Mermaid ya renderizados y navegación por teclado.
- **PDF:** una página 16:9 por diapositiva (960 × 540 pt), sin márgenes ni cabeceras, generada con Edge/Chrome headless.

## Estructura

```
src/
  components/       Editor, lista de diapositivas, presentación, barra de herramientas
  lib/
    parser.ts       separación de diapositivas, front matter y notas
    markdown.ts     renderizado y sintaxis de imágenes
    autofit.ts      cálculo del tamaño de texto por diapositiva
    project.ts      lectura/escritura del ZIP .markpoint
    recovery.ts     copia de recuperación en los datos de la app
    recent.ts       historial de archivos recientes
    export.ts       HTML autónomo y HTML de impresión
    tauri.ts        puente con diálogos, ventanas, monitores y PDF
  components/
    Presenter.tsx   vista del presentador en la ventana principal
    AudienceApp.tsx ventana de audiencia a pantalla completa
  styles/           interfaz, temas de diapositivas, CSS de exportación
src-tauri/
  src/lib.rs        comandos nativos, instancia única y exportación PDF
```

## Limitaciones conocidas

- No hay exportación a PPTX (el formato de PowerPoint no se puede reproducir con fidelidad desde HTML/Markdown).
- Las imágenes de un `.md` abierto directamente no se cargan desde el disco: usa `.markpoint` para proyectos con recursos.
- El PDF requiere Microsoft Edge o Google Chrome instalado (en Windows Edge está siempre presente).
- La asociación de archivos se registra al usar el instalador; el ejecutable portable no la crea.
- La vista de presentador elige automáticamente el monitor distinto al de la ventana principal. Si la ventana principal está en el proyector, conviene moverla antes de presentar.
