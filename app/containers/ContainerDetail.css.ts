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

export const title = style({
    fontSize: vars.fontSize.xxl,
    fontWeight: 700,
});

export const actions = style({
    display: "flex",
    gap: vars.space.sm,
    marginLeft: "auto",
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

export const infoGrid = style({
    display: "grid",
    gridTemplateColumns: "160px 1fr",
    gap: 0,
});

export const infoLabel = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    color: vars.color.textMuted,
    fontSize: vars.fontSize.sm,
    borderBottom: `1px solid ${vars.color.borderMuted}`,
});

export const infoValue = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    fontSize: vars.fontSize.md,
    borderBottom: `1px solid ${vars.color.borderMuted}`,
    wordBreak: "break-all",
});


export const backLink = style({
    color: vars.color.primary,
    fontSize: vars.fontSize.sm,
    ":hover": {
        textDecoration: "underline",
    },
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
    fontSize: vars.fontSize.sm,
    wordBreak: "break-all",
});

export const envKey = style({
    fontWeight: 500,
    fontFamily: "monospace",
});

export const envValue = style({
    fontFamily: "monospace",
    color: vars.color.textMuted,
});

export const metricsSection = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.md,
});

export const metricsHeader = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
});

export const metricsGrid = style({
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: vars.space.md,
    "@media": {
        "(max-width: 900px)": {
            gridTemplateColumns: "1fr",
        },
    },
});
