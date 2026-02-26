import { style, styleVariants, keyframes } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

const spin = keyframes({
    to: { transform: "rotate(360deg)" },
});

export const base = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: vars.space.sm,
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.sm,
    fontWeight: 500,
    transition: "background-color 0.15s, opacity 0.15s",
    selectors: {
        "&:disabled": {
            opacity: 0.6,
            cursor: "not-allowed",
        },
    },
});

export const variants = styleVariants({
    primary: {
        backgroundColor: vars.color.primary,
        color: vars.color.primaryText,
        ":hover": { backgroundColor: vars.color.primaryHover },
    },
    danger: {
        backgroundColor: vars.color.danger,
        color: vars.color.dangerText,
        ":hover": { backgroundColor: vars.color.dangerHover },
    },
    default: {
        backgroundColor: vars.color.bgSurfaceHover,
        color: vars.color.text,
        ":hover": { backgroundColor: vars.color.bgSurfaceActive },
    },
});

export const spinner = style({
    width: "14px",
    height: "14px",
    border: "2px solid currentColor",
    borderTopColor: "transparent",
    borderRadius: "50%",
    animation: `${spin} 0.6s linear infinite`,
});
