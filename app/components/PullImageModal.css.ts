import { style, keyframes } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

const fadeIn = keyframes({
    "0%": { opacity: "0" },
    "100%": { opacity: "1" },
});

const scaleIn = keyframes({
    "0%": { opacity: "0", transform: "translate(-50%, -50%) scale(0.95)" },
    "100%": { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
});

export const overlay = style({
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 2000,
    animation: `${fadeIn} 0.15s ease-out`,
});

export const dialog = style({
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    padding: vars.space.xl,
    minWidth: "400px",
    maxWidth: "520px",
    zIndex: 2001,
    boxShadow: vars.shadow.md,
    animation: `${scaleIn} 0.15s ease-out`,
    display: "flex",
    flexDirection: "column",
    gap: vars.space.md,
});

export const title = style({
    fontSize: vars.fontSize.lg,
    fontWeight: 600,
});

export const input = style({
    width: "100%",
    padding: `${vars.space.sm} ${vars.space.md}`,
    fontSize: vars.fontSize.md,
    backgroundColor: vars.color.bg,
    color: vars.color.text,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.md,
    outline: "none",
    boxSizing: "border-box",
    ":focus": {
        borderColor: vars.color.primary,
    },
});

export const actions = style({
    display: "flex",
    justifyContent: "flex-end",
    gap: vars.space.sm,
});

export const cancelButton = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.sm,
    fontWeight: 500,
    color: vars.color.textMuted,
    backgroundColor: "transparent",
    border: `1px solid ${vars.color.border}`,
    cursor: "pointer",
    transition: "background-color 0.15s, color 0.15s",
    ":hover": {
        backgroundColor: vars.color.bgSurfaceHover,
        color: vars.color.text,
    },
});

export const pullButton = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.sm,
    fontWeight: 500,
    color: vars.color.primaryText,
    backgroundColor: vars.color.primary,
    border: "none",
    cursor: "pointer",
    transition: "background-color 0.15s",
    ":hover": {
        backgroundColor: vars.color.primaryHover,
    },
    ":disabled": {
        opacity: 0.5,
        cursor: "not-allowed",
    },
});
