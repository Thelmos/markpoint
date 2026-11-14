import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { basicSetup } from "codemirror";
import { Compartment, EditorState, Transaction, type Extension } from "@codemirror/state";
import { EditorView, keymap, placeholder as placeholderExtension } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export interface EditorHandle {
  scrollToLine: (line: number, options?: { cursor?: boolean; focus?: boolean }) => void;
  insertText: (text: string) => void;
  focus: () => void;
  getCursorLine: () => number;
}

interface EditorPaneProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onCursorLine: (line: number) => void;
  onScrollLine: (line: number) => void;
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

export const EditorPane = forwardRef<EditorHandle, EditorPaneProps>(function EditorPane(
  { value, placeholder, onChange, onCursorLine, onScrollLine },
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

  callbacks.current = { onChange, onCursorLine, onScrollLine };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const extensions: Extension[] = [
      basicSetup,
      markdown(),
      syntaxHighlighting(highlightStyle),
      editorTheme,
      EditorView.lineWrapping,
      placeholderCompartment.current.of(placeholderExtension(placeholder)),
      keymap.of([indentWithTab]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          lastDocChange.current = performance.now();
          if (!suppressChange.current) {
            callbacks.current.onChange(update.state.doc.toString());
          }
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

  return <div className="editor-host" ref={hostRef} />;
});
