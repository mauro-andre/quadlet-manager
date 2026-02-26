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
    flexWrap: "wrap",
});

export const actions = style({
    display: "flex",
    gap: vars.space.sm,
    marginLeft: "auto",
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

export const section = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    overflow: "hidden",
});

export const sectionTitle = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    fontSize: vars.fontSize.sm,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: vars.color.textMuted,
    borderBottom: `1px solid ${vars.color.border}`,
});

export const logs = style({
    padding: vars.space.md,
    fontSize: vars.fontSize.sm,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    fontFamily: "monospace",
    maxHeight: "400px",
    overflow: "auto",
    color: vars.color.text,
});
