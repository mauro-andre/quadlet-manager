import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const page = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.lg,
});

export const title = style({
    fontSize: vars.fontSize.xxl,
    fontWeight: 700,
});

export const grid = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: vars.space.md,
});

export const card = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    padding: vars.space.lg,
    display: "flex",
    flexDirection: "column",
    gap: vars.space.xs,
});

export const cardLabel = style({
    fontSize: vars.fontSize.sm,
    color: vars.color.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
});

export const cardValue = style({
    fontSize: vars.fontSize.xxl,
    fontWeight: 700,
});
