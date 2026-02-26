import { style, keyframes } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

const slideIn = keyframes({
    "0%": { transform: "translateX(100%)", opacity: 0 },
    "100%": { transform: "translateX(0)", opacity: 1 },
});

export const container = style({
    position: "fixed",
    top: vars.space.lg,
    right: vars.space.lg,
    display: "flex",
    flexDirection: "column",
    gap: vars.space.sm,
    zIndex: 1000,
    pointerEvents: "none",
});

export const toast = style({
    display: "flex",
    alignItems: "center",
    gap: vars.space.sm,
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.sm,
    fontWeight: 500,
    boxShadow: vars.shadow.md,
    pointerEvents: "auto",
    cursor: "pointer",
    animation: `${slideIn} 0.25s ease-out`,
    minWidth: "250px",
    maxWidth: "400px",
});

export const success = style({
    backgroundColor: vars.color.success,
    color: vars.color.successText,
});

export const error = style({
    backgroundColor: vars.color.danger,
    color: vars.color.dangerText,
});

export const warning = style({
    backgroundColor: vars.color.warning,
    color: vars.color.warningText,
});

export const info = style({
    backgroundColor: vars.color.primary,
    color: vars.color.primaryText,
});
