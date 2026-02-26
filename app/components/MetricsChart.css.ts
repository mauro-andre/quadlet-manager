import { style, globalStyle } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const wrapper = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    overflow: "hidden",
});

export const header = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    fontSize: vars.fontSize.sm,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: vars.color.textMuted,
    borderBottom: `1px solid ${vars.color.border}`,
});

export const chartContainer = style({
    padding: vars.space.sm,
    minHeight: "200px",
    color: vars.color.textMuted,
});

export const empty = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "200px",
    color: vars.color.textMuted,
    fontSize: vars.fontSize.sm,
});

// uPlot overrides
globalStyle(`${chartContainer} .u-legend`, {
    display: "none",
});
