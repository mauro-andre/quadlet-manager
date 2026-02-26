import { style, keyframes } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

const pulse = keyframes({
    "0%": { boxShadow: `0 0 0 0 rgba(34, 197, 94, 0.6)` },
    "70%": { boxShadow: `0 0 0 6px rgba(34, 197, 94, 0)` },
    "100%": { boxShadow: `0 0 0 0 rgba(34, 197, 94, 0)` },
});

export const wrapper = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    overflow: "hidden",
});

export const header = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderBottom: `1px solid ${vars.color.border}`,
});

export const title = style({
    display: "flex",
    alignItems: "center",
    gap: vars.space.sm,
    fontSize: vars.fontSize.sm,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: vars.color.textMuted,
});

export const indicator = style({
    display: "inline-flex",
    alignItems: "center",
    gap: vars.space.xs,
    fontSize: vars.fontSize.xs,
    fontWeight: 400,
    textTransform: "none",
    letterSpacing: "0",
});

export const dot = style({
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: vars.color.textMuted,
});

export const dotConnected = style({
    backgroundColor: vars.color.success,
    animation: `${pulse} 2s ease-out infinite`,
});

export const logs = style({
    padding: vars.space.md,
    fontSize: vars.fontSize.sm,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    fontFamily: "monospace",
    maxHeight: "500px",
    overflow: "auto",
    color: vars.color.text,
    minHeight: "200px",
});
