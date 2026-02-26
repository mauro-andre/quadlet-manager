import type { Signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { EditorView, lineNumbers, highlightActiveLineGutter, highlightActiveLine, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, HighlightStyle, StreamLanguage } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { vars } from "../styles/theme.css.js";
import * as css from "./CodeEditor.css.js";

// INI/systemd-unit language mode
const iniLanguage = StreamLanguage.define({
    token(stream) {
        if (stream.match(/^[#;].*/)) return "comment";
        if (stream.match(/^\[.*?\]/)) return "keyword";
        if (stream.sol() && stream.match(/^[A-Za-z][A-Za-z0-9_-]*/)) {
            if (stream.peek() === "=") return "propertyName";
            stream.skipToEnd();
            return "string";
        }
        if (stream.eat("=")) return "operator";
        stream.skipToEnd();
        return "string";
    },
    startState() {
        return {};
    },
});

// Theme that uses CSS variables — adapts automatically when app theme changes
const editorTheme = EditorView.theme({
    "&": {
        backgroundColor: vars.color.editorBg,
        color: vars.color.text,
    },
    ".cm-content": {
        caretColor: vars.color.editorCursor,
    },
    ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: vars.color.editorCursor,
    },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: vars.color.editorSelection,
    },
    ".cm-gutters": {
        backgroundColor: vars.color.editorGutter,
        color: vars.color.textMuted,
        borderRight: `1px solid ${vars.color.border}`,
    },
    ".cm-activeLineGutter": {
        backgroundColor: vars.color.editorActiveLine,
        color: vars.color.text,
    },
    ".cm-activeLine": {
        backgroundColor: vars.color.editorActiveLine,
    },
});

const editorHighlightStyle = HighlightStyle.define([
    { tag: tags.comment, color: vars.color.syntaxComment, fontStyle: "italic" },
    { tag: tags.keyword, color: vars.color.syntaxKeyword, fontWeight: "bold" },
    { tag: tags.propertyName, color: vars.color.syntaxProperty },
    { tag: tags.string, color: vars.color.syntaxString },
    { tag: tags.operator, color: vars.color.syntaxOperator },
]);

interface CodeEditorProps {
    value: Signal<string>;
    readonly?: boolean;
}

export function CodeEditor({ value, readonly }: CodeEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const state = EditorState.create({
            doc: value.value,
            extensions: [
                lineNumbers(),
                highlightActiveLineGutter(),
                highlightActiveLine(),
                history(),
                keymap.of([...defaultKeymap, ...historyKeymap]),
                iniLanguage,
                editorTheme,
                syntaxHighlighting(editorHighlightStyle),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        value.value = update.state.doc.toString();
                    }
                }),
                ...(readonly ? [EditorState.readOnly.of(true)] : []),
            ],
        });

        const view = new EditorView({
            state,
            parent: containerRef.current,
        });

        viewRef.current = view;

        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, []);

    // Sync external value changes (e.g., loader data) into the editor
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const current = view.state.doc.toString();
        if (current !== value.value) {
            view.dispatch({
                changes: { from: 0, to: current.length, insert: value.value },
            });
        }
    }, [value.value]);

    return <div class={css.wrapper} ref={containerRef} />;
}
