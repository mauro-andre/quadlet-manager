import { style, keyframes, styleVariants } from "@vanilla-extract/css";
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

export const header = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
});

export const pullButton = style({
    display: "inline-flex",
    alignItems: "center",
    padding: `${vars.space.sm} ${vars.space.md}`,
    backgroundColor: vars.color.primary,
    color: vars.color.primaryText,
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.sm,
    fontWeight: 500,
    cursor: "pointer",
    border: "none",
    ":hover": {
        backgroundColor: vars.color.primaryHover,
    },
});

export const progressSection = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.sm,
});

export const progressCard = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    padding: vars.space.md,
    display: "flex",
    flexDirection: "column",
    gap: vars.space.sm,
});

export const progressCardError = style({
    borderColor: vars.color.danger,
});

export const progressHeader = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
});

export const progressReference = style({
    fontSize: vars.fontSize.md,
    fontWeight: 600,
});

export const progressStatus = style({
    fontSize: vars.fontSize.xs,
    color: vars.color.textMuted,
    fontWeight: 500,
});

export const progressMessage = style({
    fontSize: vars.fontSize.sm,
    color: vars.color.textMuted,
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const progressError = style({
    fontSize: vars.fontSize.sm,
    color: vars.color.danger,
});

const indeterminate = keyframes({
    "0%": { transform: "translateX(-100%)" },
    "100%": { transform: "translateX(200%)" },
});

export const progressBar = style({
    height: "4px",
    borderRadius: "2px",
    backgroundColor: vars.color.border,
    overflow: "hidden",
});

export const progressFill = style({
    height: "100%",
    width: "50%",
    borderRadius: "2px",
    backgroundColor: vars.color.primary,
    animation: `${indeterminate} 1.5s ease-in-out infinite`,
});

export const checkButton = style({
    display: "inline-flex",
    alignItems: "center",
    padding: `${vars.space.sm} ${vars.space.md}`,
    backgroundColor: vars.color.bgSurfaceActive,
    color: vars.color.text,
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.sm,
    fontWeight: 500,
    cursor: "pointer",
    border: `1px solid ${vars.color.border}`,
    ":hover": {
        backgroundColor: vars.color.bgSurfaceHover,
    },
    selectors: {
        "&:disabled": {
            opacity: 0.6,
            cursor: "not-allowed",
        },
    },
});

export const headerActions = style({
    display: "flex",
    gap: vars.space.sm,
    alignItems: "center",
});

const updateBadgeBase = style({
    display: "inline-flex",
    alignItems: "center",
    gap: vars.space.xs,
    padding: `2px ${vars.space.sm}`,
    borderRadius: vars.radius.sm,
    fontSize: vars.fontSize.xs,
    fontWeight: 600,
    whiteSpace: "nowrap",
});

export const updateBadge = styleVariants({
    "update-available": [updateBadgeBase, {
        backgroundColor: "rgba(108, 140, 255, 0.15)",
        color: vars.color.primary,
    }],
    "restart-pending": [updateBadgeBase, {
        backgroundColor: "rgba(252, 196, 25, 0.15)",
        color: vars.color.warning,
    }],
    "tag-removed": [updateBadgeBase, {
        backgroundColor: "rgba(255, 107, 107, 0.15)",
        color: vars.color.danger,
    }],
    "up-to-date": [updateBadgeBase, {
        backgroundColor: "rgba(81, 207, 102, 0.15)",
        color: vars.color.success,
    }],
    unknown: [updateBadgeBase, {
        backgroundColor: "rgba(139, 144, 160, 0.15)",
        color: vars.color.textMuted,
    }],
});
