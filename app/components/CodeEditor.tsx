import type { Signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { EditorView, lineNumbers, highlightActiveLineGutter, highlightActiveLine, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, HighlightStyle, StreamLanguage } from "@codemirror/language";
import { oneDarkTheme, oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import { tags } from "@lezer/highlight";
import * as css from "./CodeEditor.css.js";

// Simple INI/systemd-unit language mode
const iniLanguage = StreamLanguage.define({
    token(stream) {
        // Comments
        if (stream.match(/^[#;].*/)) return "comment";
        // Section headers [Unit], [Container], etc
        if (stream.match(/^\[.*?\]/)) return "keyword";
        // Key=Value on same line
        if (stream.sol() && stream.match(/^[A-Za-z][A-Za-z0-9_-]*/)) {
            if (stream.peek() === "=") return "propertyName";
            // Not a key, treat as string
            stream.skipToEnd();
            return "string";
        }
        // Equals sign
        if (stream.eat("=")) return "operator";
        // Rest of line (value)
        stream.skipToEnd();
        return "string";
    },
    startState() {
        return {};
    },
});

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
                oneDarkTheme,
                syntaxHighlighting(oneDarkHighlightStyle),
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
