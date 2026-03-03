import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const card = style({
    width: "100%",
    maxWidth: "380px",
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    padding: vars.space.xl,
    boxShadow: vars.shadow.md,
});

export const title = style({
    fontSize: vars.fontSize.xl,
    fontWeight: 700,
    marginBottom: vars.space.xs,
});

export const subtitle = style({
    fontSize: vars.fontSize.sm,
    color: vars.color.textMuted,
    marginBottom: vars.space.lg,
});

export const form = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.md,
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
    borderRadius: vars.radius.md,
    border: `1px solid ${vars.color.border}`,
    backgroundColor: vars.color.bg,
    color: vars.color.text,
    fontSize: vars.fontSize.md,
    outline: "none",
    transition: "border-color 0.15s",
    ":focus": {
        borderColor: vars.color.primary,
    },
});

export const submitButton = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderRadius: vars.radius.md,
    backgroundColor: vars.color.primary,
    color: vars.color.primaryText,
    fontSize: vars.fontSize.md,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.15s",
    marginTop: vars.space.sm,
    ":hover": {
        backgroundColor: vars.color.primaryHover,
    },
    ":disabled": {
        opacity: 0.6,
        cursor: "not-allowed",
    },
});

export const error = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderRadius: vars.radius.md,
    backgroundColor: "rgba(255, 107, 107, 0.15)",
    color: vars.color.danger,
    fontSize: vars.fontSize.sm,
});
