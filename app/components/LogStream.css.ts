import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const wrapper = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    overflow: "hidden",
});

export const header = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderBottom: `1px solid ${vars.color.border}`,
});

export const title = style({
    fontSize: vars.fontSize.sm,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: vars.color.textMuted,
});

export const indicator = style({
    display: "flex",
    alignItems: "center",
    gap: vars.space.xs,
    fontSize: vars.fontSize.sm,
    color: vars.color.textMuted,
});

export const dot = style({
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: vars.color.textMuted,
});

export const dotConnected = style({
    backgroundColor: vars.color.success,
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
