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

export const summaryGrid = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: vars.space.md,
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

export const cardSub = style({
    fontSize: vars.fontSize.sm,
    color: vars.color.textMuted,
});

export const resourceSection = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.md,
});

export const sectionTitle = style({
    fontSize: vars.fontSize.lg,
    fontWeight: 600,
});

export const resourceGrid = style({
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: vars.space.md,
    "@media": {
        "(max-width: 900px)": {
            gridTemplateColumns: "1fr",
        },
    },
});

export const resourceCard = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    padding: vars.space.lg,
    display: "flex",
    flexDirection: "column",
    gap: vars.space.md,
});

export const resourceCardTitle = style({
    fontSize: vars.fontSize.sm,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: vars.color.textMuted,
});

export const resourceRow = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
});

export const resourceLabel = style({
    fontSize: vars.fontSize.sm,
    color: vars.color.textMuted,
});

export const resourceValue = style({
    fontSize: vars.fontSize.lg,
    fontWeight: 600,
});

export const progressBar = style({
    height: "6px",
    borderRadius: "3px",
    backgroundColor: vars.color.border,
    overflow: "hidden",
});

export const progressFill = style({
    height: "100%",
    borderRadius: "3px",
    transition: "width 0.5s ease",
});

export const diskGrid = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.md,
});

export const diskPodmanGrid = style({
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: vars.space.md,
    "@media": {
        "(max-width: 900px)": {
            gridTemplateColumns: "1fr",
        },
    },
});

export const diskCard = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    padding: vars.space.lg,
    display: "flex",
    flexDirection: "column",
    gap: vars.space.sm,
});

export const diskCardTitle = style({
    fontSize: vars.fontSize.sm,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: vars.color.textMuted,
});

export const diskCardValue = style({
    fontSize: vars.fontSize.xxl,
    fontWeight: 700,
});

export const diskCardSub = style({
    fontSize: vars.fontSize.sm,
    color: vars.color.textMuted,
});

export const partitionList = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.md,
});

export const partitionItem = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.xs,
});

export const partitionHeader = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
});

export const partitionMount = style({
    fontSize: vars.fontSize.md,
    fontWeight: 600,
});

export const partitionSize = style({
    fontSize: vars.fontSize.sm,
    color: vars.color.textMuted,
});

export const partitionDetail = style({
    display: "flex",
    justifyContent: "space-between",
    fontSize: vars.fontSize.xs,
    color: vars.color.textMuted,
});
