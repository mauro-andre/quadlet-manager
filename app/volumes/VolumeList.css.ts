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

export const tableWrapper = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    overflow: "hidden",
});

export const table = style({
    width: "100%",
    borderCollapse: "collapse",
});

export const th = style({
    textAlign: "left",
    padding: `${vars.space.sm} ${vars.space.md}`,
    fontSize: vars.fontSize.xs,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: vars.color.textMuted,
    borderBottom: `1px solid ${vars.color.border}`,
});

export const td = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderBottom: `1px solid ${vars.color.borderMuted}`,
    fontSize: vars.fontSize.md,
});

export const nameLink = style({
    color: vars.color.primary,
    fontWeight: 500,
    ":hover": {
        textDecoration: "underline",
    },
});

export const actionsCell = style({
    display: "flex",
    gap: vars.space.sm,
});

export const empty = style({
    padding: vars.space.xl,
    textAlign: "center",
    color: vars.color.textMuted,
});

export const anonName = style({
    color: vars.color.textMuted,
    fontFamily: "monospace",
    fontSize: vars.fontSize.sm,
});

export const badge = style({
    display: "inline-block",
    padding: `2px ${vars.space.sm}`,
    borderRadius: vars.radius.sm,
    fontSize: vars.fontSize.xs,
    fontWeight: 600,
    textTransform: "uppercase",
});

export const badgeInUse = style({
    backgroundColor: "rgba(81, 207, 102, 0.15)",
    color: "#51cf66",
});

export const badgeUnused = style({
    backgroundColor: "rgba(255, 107, 107, 0.15)",
    color: "#ff6b6b",
});
