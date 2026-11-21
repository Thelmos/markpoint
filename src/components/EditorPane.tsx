import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { basicSetup } from "codemirror";
import {
  Compartment,
  EditorState,
  StateEffect,
  StateField,
  Transaction,
  type Extension,
  type Range,
} from "@codemirror/state";
import { Decoration, EditorView, keymap, placeholder as placeholderExtension } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import type { ThemeHints } from "../lib/themeHints";
import { EditorContextMenu, type EditorFormat } from "./EditorContextMenu";

export interface EditorHandle {
  scrollToLine: (line: number, options?: { cursor?: boolean; focus?: boolean }) => void;
  insertText: (text: string) => void;
  replaceRange: (
    from: number,
    to: number,
    insert: string,
    options?: { preserveCursor?: boolean },
  ) => void;
  focus: () => void;
  getCursorLine: () => number;
}

interface EditorPaneProps {
  value: string;
  placeholder: string;
  /** Lines of the slide that is being edited; everything else is dimmed. */
  activeLines: { from: number; to: number } | null;
  /** Line range of the theme block and the description of each key. */
  themeHints: ThemeHints | null;
  onChange: (value: string) => void;
  onCursorLine: (line: number) => void;
  onScrollLine: (line: number) => void;
  onInsertImage: () => void;
}

interface TextEdit {
  changes: Array<{ from: number; to: number; insert: string }>;
  selection: { anchor: number; head: number };
}

const HEADING_PREFIX = /^(#{1,6})\s+/;

/** Counts the asterisks that touch a position on one side. */
function countStars(state: EditorState, pos: number, direction: -1 | 1): number {
  let count = 0;
  while (true) {
    const next = pos + direction * (count + 1);
    if (next < 0 || next > state.doc.length) break;
    const from = direction === 1 ? next - 1 : next;
    if (state.doc.sliceString(from, from + 1) !== "*") break;
    count += 1;
  }
  return count;
}

/** Wraps or unwraps the current selection with an inline marker. */
function toggleInline(state: EditorState, marker: string): TextEdit | null {
  const { from, to } = state.selection.main;
  if (from === to) return null;
  const text = state.doc.sliceString(from, to);

  // Asterisks next to the selection may belong to bold (two) or to bold and
  // italic (three). Removing or adding a single marker keeps those pairs.
  const beforeStars = countStars(state, from, -1);
  const afterStars = countStars(state, to, 1);
  const removeCount =
    marker === "**"
      ? beforeStars >= 2 && afterStars >= 2
        ? 2
        : 0
      : beforeStars === afterStars && beforeStars % 2 === 1
        ? 1
        : 0;

  if (removeCount > 0) {
    const anchor = from - removeCount;
    return {
      changes: [
        { from: anchor, to: from, insert: "" },
        { from: to, to: to + removeCount, insert: "" },
      ],
      selection: { anchor, head: to - removeCount },
    };
  }

  // When the selection already includes the markers, remove them instead of
  // wrapping again. A single asterisk must not strip the markers of bold text.
  const wrapped =
    marker === "*"
      ? text.length > 2 &&
        text.startsWith("*") &&
        text.endsWith("*") &&
        !(text.startsWith("**") && !text.startsWith("***")) &&
        !(text.endsWith("**") && !text.endsWith("***"))
      : text.length > marker.length * 2 &&
        text.startsWith(marker) &&
        text.endsWith(marker);

  if (wrapped) {
    const inner = text.slice(marker.length, text.length - marker.length);
    return {
      changes: [{ from, to, insert: inner }],
      selection: { anchor: from, head: from + inner.length },
    };
  }

  return {
    changes: [{ from, to, insert: `${marker}${text}${marker}` }],
    selection: { anchor: from + marker.length, head: to + marker.length },
  };
}

/** Sets (or toggles off) an ATX heading on every line touched by the selection. */
function applyHeading(state: EditorState, level: number): TextEdit | null {
  const { from, to } = state.selection.main;
  if (from === to) return null;

  const first = state.doc.lineAt(from);
  let last = state.doc.lineAt(to);
  if (last.number > first.number && to === last.from) {
    last = state.doc.line(last.number - 1);
  }

  const lines: Array<{ from: number; to: number; text: string }> = [];
  for (let number = first.number; number <= last.number; number += 1) {
    const line = state.doc.line(number);
    lines.push({ from: line.from, to: line.to, text: line.text });
  }

  const contentLines = lines.filter((line) => line.text.trim() !== "");
  const alreadySet = contentLines.every((line) => {
    const match = HEADING_PREFIX.exec(line.text);
    return match?.[1].length === level;
  });
  const remove = contentLines.length > 0 && alreadySet;
  const prefix = `${"#".repeat(level)} `;

  const changes: TextEdit["changes"] = [];
  let delta = 0;
  for (const line of lines) {
    if (!line.text.trim()) continue;
    const base = line.text.replace(HEADING_PREFIX, "");
    const next = remove ? base : `${prefix}${base}`;
    if (next === line.text) continue;
    changes.push({ from: line.from, to: line.to, insert: next });
    delta += next.length - line.text.length;
  }

  if (changes.length === 0) return null;
  return {
    changes,
    selection: { anchor: first.from, head: last.to + delta },
  };
}

const highlightStyle = HighlightStyle.define([
  { tag: tags.heading1, color: "#8ab4ff", fontWeight: "700" },
  { tag: [tags.heading2, tags.heading3], color: "#a5b4fc", fontWeight: "700" },
  { tag: [tags.heading4, tags.heading5, tags.heading6], color: "#7dd3fc", fontWeight: "650" },
  { tag: tags.strong, color: "#f1f5fb", fontWeight: "700" },
  { tag: tags.emphasis, color: "#d8b4fe", fontStyle: "italic" },
  { tag: tags.strikethrough, color: "#64748b", textDecoration: "line-through" },
  { tag: tags.link, color: "#67e8f9", textDecoration: "underline" },
  { tag: tags.url, color: "#67e8f9" },
  { tag: tags.monospace, color: "#fbbf24" },
  { tag: tags.quote, color: "#94a3b8", fontStyle: "italic" },
  { tag: tags.list, color: "#fbbf24" },
  { tag: tags.contentSeparator, color: "#475569", fontWeight: "700" },
  { tag: tags.comment, color: "#64748b" },
  { tag: tags.keyword, color: "#c4a7ff" },
  { tag: tags.string, color: "#9be28f" },
  { tag: tags.number, color: "#ffc46b" },
  { tag: tags.bool, color: "#ffc46b" },
  { tag: tags.typeName, color: "#6fe3e1" },
  { tag: tags.function(tags.variableName), color: "#8ab4ff" },
  { tag: tags.definition(tags.variableName), color: "#8ab4ff" },
  { tag: tags.processingInstruction, color: "#f472b6" },
  { tag: tags.operator, color: "#94a3b8" },
  { tag: tags.punctuation, color: "#7c8aa0" },
  { tag: tags.invalid, color: "#ff6b81" },
]);

const editorTheme = EditorView.theme(
  {
    "&": { height: "100%", backgroundColor: "transparent" },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
      fontFamily: '"Cascadia Code", "Cascadia Mono", Consolas, monospace',
    },
  },
  { dark: true },
);

const setActiveLines = StateEffect.define<{ from: number; to: number } | null>();

/** Identity of a line range; slides are re-parsed on every keystroke. */
function linesKey(range: { from: number; to: number } | null): string {
  return range ? `${range.from}:${range.to}` : "";
}

const activeLinesField = StateField.define<{ from: number; to: number } | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setActiveLines)) return effect.value;
    }
    return value;
  },
});

/** Marks the lines of the active slide so the rest can be dimmed with CSS. */
const activeLinesDecoration = EditorView.decorations.compute(
  ["doc", activeLinesField],
  (state) => {
    const range = state.field(activeLinesField);
    if (!range) return Decoration.none;
    const first = Math.max(1, Math.min(range.from, state.doc.lines));
    const last = Math.min(range.to, state.doc.lines);
    const decorations: Range<Decoration>[] = [];
    for (let number = first; number <= last; number += 1) {
      decorations.push(
        Decoration.line({ class: "cm-active-slide" }).range(state.doc.line(number).from),
      );
    }
    return Decoration.set(decorations);
  },
);

const setThemeHints = StateEffect.define<ThemeHints | null>();

const themeHintsField = StateField.define<ThemeHints | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setThemeHints)) return effect.value;
    }
    return value;
  },
});

/** Marks each theme key with a native tooltip describing what it changes. */
const themeHintsDecoration = EditorView.decorations.compute(
  ["doc", themeHintsField],
  (state) => {
    const range = state.field(themeHintsField);
    if (!range) return Decoration.none;
    const first = Math.max(1, Math.min(range.from, state.doc.lines));
    const last = Math.min(range.to, state.doc.lines);
    const marks: Range<Decoration>[] = [];
    for (let number = first; number <= last; number += 1) {
      const line = state.doc.line(number);
      const match = /^(\s*(?:-\s*)?)([A-Za-z][A-Za-z0-9]*)\s*:/.exec(line.text);
      if (!match) continue;
      const key = match[2];
      const hint = range.hints[key];
      if (!hint) continue;
      const start = line.from + match[1].length;
      marks.push(
        Decoration.mark({
          class: "cm-theme-key",
          attributes: { title: hint },
        }).range(start, start + key.length),
      );
    }
    return Decoration.set(marks);
  },
);

export const EditorPane = forwardRef<EditorHandle, EditorPaneProps>(function EditorPane(
  { value, placeholder, activeLines, themeHints, onChange, onCursorLine, onScrollLine, onInsertImage },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const suppressChange = useRef(false);
  const suppressScrollUntil = useRef(0);
  const lastDocChange = useRef(0);
  const initialValue = useRef(value);
  const placeholderCompartment = useRef(new Compartment());
  const callbacks = useRef({ onChange, onCursorLine, onScrollLine });
  const activeLinesRef = useRef(activeLines);
  const activeLinesKey = useRef(linesKey(activeLines));
  const themeHintsKey = useRef("");
  const [menu, setMenu] = useState<{ x: number; y: number; hasSelection: boolean } | null>(
    null,
  );

  callbacks.current = { onChange, onCursorLine, onScrollLine };
  activeLinesRef.current = activeLines;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const extensions: Extension[] = [
      basicSetup,
      markdown(),
      syntaxHighlighting(highlightStyle),
      editorTheme,
      activeLinesField,
      activeLinesDecoration,
      themeHintsField,
      themeHintsDecoration,
      EditorView.lineWrapping,
      placeholderCompartment.current.of(placeholderExtension(placeholder)),
      keymap.of([indentWithTab]),
      EditorView.domEventHandlers({
        contextmenu(event, view) {
          event.preventDefault();
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          const selection = view.state.selection.main;
          if (pos != null && (pos < selection.from || pos > selection.to)) {
            view.dispatch({ selection: { anchor: pos } });
          }
          view.focus();
          const current = view.state.selection.main;
          setMenu({
            x: event.clientX,
            y: event.clientY,
            hasSelection: current.from !== current.to,
          });
          return true;
        },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          lastDocChange.current = performance.now();
          if (!suppressChange.current) {
            callbacks.current.onChange(update.state.doc.toString());
          }
          setMenu(null);
        }
        if ((update.selectionSet || update.docChanged) && !suppressChange.current) {
          if (update.selectionSet) suppressScrollUntil.current = performance.now() + 220;
          callbacks.current.onCursorLine(
            update.state.doc.lineAt(update.state.selection.main.head).number,
          );
        }
      }),
    ];

    const view = new EditorView({
      state: EditorState.create({ doc: initialValue.current, extensions }),
      parent: host,
    });
    viewRef.current = view;
    if (activeLinesRef.current) {
      view.dispatch({ effects: setActiveLines.of(activeLinesRef.current) });
    }

    let raf = 0;
    const onScroll = () => {
      if (performance.now() < suppressScrollUntil.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (performance.now() < suppressScrollUntil.current) return;
        const scrollTop = view.scrollDOM.scrollTop;
        const height = view.scrollDOM.clientHeight;
        const typingRecently = performance.now() - lastDocChange.current < 700;
        const line = typingRecently
          ? view.state.doc.lineAt(view.state.selection.main.head).number
          : view.state.doc.lineAt(view.lineBlockAtHeight(scrollTop + height * 0.35).from).number;
        callbacks.current.onScrollLine(line);
      });
    };
    view.scrollDOM.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      view.scrollDOM.removeEventListener("scroll", onScroll);
      view.destroy();
      viewRef.current = null;
    };
    // The editor is created once; callbacks are read through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: placeholderCompartment.current.reconfigure(placeholderExtension(placeholder)),
    });
  }, [placeholder]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const key = linesKey(activeLines);
    if (key === activeLinesKey.current) return;
    activeLinesKey.current = key;
    view.dispatch({ effects: setActiveLines.of(activeLines) });
  }, [activeLines]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const key = themeHints
      ? `${themeHints.from}:${themeHints.to}:${themeHints.hints.bg ?? ""}`
      : "";
    if (key === themeHintsKey.current) return;
    themeHintsKey.current = key;
    view.dispatch({ effects: setThemeHints.of(themeHints) });
  }, [themeHints]);

  const closeMenu = useCallback(() => {
    setMenu(null);
    viewRef.current?.focus();
  }, []);

  const applyFormat = useCallback((format: EditorFormat) => {
    const view = viewRef.current;
    setMenu(null);
    if (!view) return;
    const state = view.state;
    const edit =
      format === "bold"
        ? toggleInline(state, "**")
        : format === "italic"
          ? toggleInline(state, "*")
          : applyHeading(state, Number(format.slice(-1)));
    if (edit) view.dispatch({ changes: edit.changes, selection: edit.selection });
    view.focus();
  }, []);

  useEffect(() => {
    if (!menu) return;
    const view = viewRef.current;
    if (!view) return;
    const close = () => setMenu(null);
    view.scrollDOM.addEventListener("scroll", close, { passive: true });
    return () => view.scrollDOM.removeEventListener("scroll", close);
  }, [menu]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;

    suppressChange.current = true;
    const anchor = Math.min(view.state.selection.main.anchor, value.length);
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      selection: { anchor },
      scrollIntoView: false,
      annotations: Transaction.addToHistory.of(false),
    });
    suppressChange.current = false;
  }, [value]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToLine(line, options) {
        const view = viewRef.current;
        if (!view) return;
        const target = Math.min(Math.max(1, Math.round(line)), view.state.doc.lines);
        const pos = view.state.doc.line(target).from;
        suppressScrollUntil.current = performance.now() + 420;
        view.dispatch({
          selection: options?.cursor ? { anchor: pos } : undefined,
          effects: EditorView.scrollIntoView(pos, { y: "center" }),
        });
        if (options?.cursor) suppressScrollUntil.current = performance.now() + 420;
        if (options?.focus) view.focus();
      },
      insertText(text) {
        const view = viewRef.current;
        if (!view) return;
        const selection = view.state.selection.main;
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: text },
          selection: { anchor: selection.from + text.length },
          scrollIntoView: true,
        });
        view.focus();
      },
      replaceRange(from, to, insert, options) {
        const view = viewRef.current;
        if (!view) return;
        const length = view.state.doc.length;
        const start = Math.min(Math.max(0, from), length);
        const end = Math.min(Math.max(start, to), length);
        const changes = { from: start, to: end, insert };

        if (!options?.preserveCursor) {
          view.dispatch({ changes, scrollIntoView: false });
          return;
        }

        // Map the cursor so it keeps its place in the surrounding content.
        // A cursor at the insertion point moves after the inserted text.
        const move = (position: number) => {
          if (position >= end) return position + insert.length - (end - start);
          if (position >= start) return start + insert.length;
          return position;
        };
        const { anchor, head } = view.state.selection.main;
        view.dispatch({
          changes,
          selection: { anchor: move(anchor), head: move(head) },
          scrollIntoView: false,
        });
      },
      focus() {
        viewRef.current?.focus();
      },
      getCursorLine() {
        const view = viewRef.current;
        if (!view) return 1;
        return view.state.doc.lineAt(view.state.selection.main.head).number;
      },
    }),
    [],
  );

  return (
    <>
      <div className={`editor-host${activeLines ? " slide-focus" : ""}`} ref={hostRef} />
      {menu ? (
        <EditorContextMenu
          x={menu.x}
          y={menu.y}
          hasSelection={menu.hasSelection}
          onInsertImage={onInsertImage}
          onFormat={applyFormat}
          onClose={closeMenu}
        />
      ) : null}
    </>
  );
});
