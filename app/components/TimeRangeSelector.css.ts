import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const wrapper = style({
    display: "flex",
    gap: "2px",
    backgroundColor: vars.color.border,
    borderRadius: vars.radius.md,
    overflow: "hidden",
    width: "fit-content",
});

export const button = style({
    padding: `${vars.space.xs} ${vars.space.md}`,
    fontSize: vars.fontSize.xs,
    fontWeight: 500,
    color: vars.color.textMuted,
    backgroundColor: vars.color.bgSurface,
    cursor: "pointer",
    transition: "background-color 0.15s, color 0.15s",
    ":hover": {
        backgroundColor: vars.color.bgSurfaceHover,
        color: vars.color.text,
    },
});

export const buttonActive = style({
    backgroundColor: vars.color.primary,
    color: vars.color.primaryText,
    ":hover": {
        backgroundColor: vars.color.primaryHover,
        color: vars.color.primaryText,
    },
});
