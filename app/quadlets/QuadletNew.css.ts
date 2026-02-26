import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const page = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.lg,
});

export const header = style({
    display: "flex",
    alignItems: "center",
    gap: vars.space.md,
});

export const title = style({
    fontSize: vars.fontSize.xxl,
    fontWeight: 700,
    flex: 1,
});

export const backLink = style({
    color: vars.color.primary,
    fontSize: vars.fontSize.sm,
    ":hover": {
        textDecoration: "underline",
    },
});

export const form = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.md,
});

export const fieldGroup = style({
    display: "flex",
    gap: vars.space.md,
    alignItems: "flex-end",
});

export const field = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.xs,
});

export const label = style({
    fontSize: vars.fontSize.sm,
    fontWeight: 500,
    color: vars.color.textMuted,
});

export const input = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    backgroundColor: vars.color.bg,
    color: vars.color.text,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.md,
    outline: "none",
    ":focus": {
        borderColor: vars.color.primary,
    },
});

export const select = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    backgroundColor: vars.color.bg,
    color: vars.color.text,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.md,
    outline: "none",
    ":focus": {
        borderColor: vars.color.primary,
    },
});
