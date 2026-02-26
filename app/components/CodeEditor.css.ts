import { style, globalStyle } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const wrapper = style({
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    overflow: "hidden",
});

// CodeMirror overrides to match our theme
globalStyle(`${wrapper} .cm-editor`, {
    fontSize: vars.fontSize.sm,
    minHeight: "400px",
    maxHeight: "600px",
});

globalStyle(`${wrapper} .cm-editor.cm-focused`, {
    outline: "none",
});

globalStyle(`${wrapper} .cm-scroller`, {
    overflow: "auto",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
});
