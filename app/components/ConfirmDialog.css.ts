import { style, keyframes } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

const fadeIn = keyframes({
    "0%": { opacity: 0 },
    "100%": { opacity: 1 },
});

const scaleIn = keyframes({
    "0%": { opacity: 0, transform: "translate(-50%, -50%) scale(0.95)" },
    "100%": { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
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
    minWidth: "360px",
    maxWidth: "480px",
    zIndex: 2001,
    boxShadow: vars.shadow.md,
    animation: `${scaleIn} 0.15s ease-out`,
});

export const message = style({
    fontSize: vars.fontSize.md,
    color: vars.color.text,
    lineHeight: 1.5,
    marginBottom: vars.space.lg,
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

export const confirmButton = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.sm,
    fontWeight: 500,
    color: vars.color.dangerText,
    backgroundColor: vars.color.danger,
    cursor: "pointer",
    transition: "background-color 0.15s",
    ":hover": {
        backgroundColor: vars.color.dangerHover,
    },
});

export const confirmButtonWarning = style({
    backgroundColor: vars.color.warning,
    color: vars.color.warningText,
    ":hover": {
        backgroundColor: vars.color.warning,
        filter: "brightness(0.9)",
    },
});
