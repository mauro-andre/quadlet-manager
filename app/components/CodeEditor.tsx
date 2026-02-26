import type { Signal } from "@preact/signals";
import * as css from "./CodeEditor.css.js";

interface CodeEditorProps {
    value: Signal<string>;
    readonly?: boolean;
}

export function CodeEditor({ value, readonly }: CodeEditorProps) {
    return (
        <div class={css.wrapper}>
            <textarea
                class={`${css.textarea} code`}
                value={value.value}
                onInput={(e) => {
                    value.value = (e.target as HTMLTextAreaElement).value;
                }}
                readOnly={readonly}
                spellcheck={false}
            />
        </div>
    );
}
