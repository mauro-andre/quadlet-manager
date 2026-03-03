import { style, keyframes } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

const spin = keyframes({
    to: { transform: "rotate(360deg)" },
});

export const page = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.lg,
});

export const title = style({
    fontSize: vars.fontSize.xxl,
    fontWeight: 700,
});

export const card = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    padding: vars.space.lg,
    display: "flex",
    flexDirection: "column",
    gap: vars.space.md,
});

export const cardTitle = style({
    fontSize: vars.fontSize.lg,
    fontWeight: 600,
});

export const versionRow = style({
    display: "flex",
    alignItems: "center",
    gap: vars.space.md,
});

export const versionLabel = style({
    fontSize: vars.fontSize.sm,
    color: vars.color.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    fontWeight: 600,
});

export const versionValue = style({
    fontSize: vars.fontSize.lg,
    fontWeight: 500,
    fontFamily: "monospace",
});

export const badge = style({
    display: "inline-flex",
    alignItems: "center",
    padding: `${vars.space.xs} ${vars.space.sm}`,
    borderRadius: vars.radius.sm,
    fontSize: vars.fontSize.xs,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
});

export const badgeSuccess = style({
    backgroundColor: vars.color.success,
    color: vars.color.successText,
});

export const badgeWarning = style({
    backgroundColor: vars.color.warning,
    color: vars.color.warningText,
});

export const releaseInfo = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.sm,
    padding: vars.space.md,
    backgroundColor: vars.color.bg,
    borderRadius: vars.radius.md,
    border: `1px solid ${vars.color.borderMuted}`,
});

export const releaseDate = style({
    fontSize: vars.fontSize.sm,
    color: vars.color.textMuted,
});

export const releaseNotes = style({
    fontSize: vars.fontSize.md,
    lineHeight: "1.6",
    whiteSpace: "pre-wrap",
    maxHeight: "300px",
    overflowY: "auto",
});

export const updateButton = style({
    alignSelf: "flex-start",
    padding: `${vars.space.sm} ${vars.space.lg}`,
    backgroundColor: vars.color.primary,
    color: vars.color.primaryText,
    border: "none",
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.md,
    fontWeight: 500,
    cursor: "pointer",
    ":hover": {
        backgroundColor: vars.color.primaryHover,
    },
    selectors: {
        "&:disabled": {
            opacity: 0.6,
            cursor: "not-allowed",
        },
    },
});

export const progressCard = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.primary}`,
    borderRadius: vars.radius.lg,
    padding: vars.space.lg,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: vars.space.md,
});

export const progressText = style({
    fontSize: vars.fontSize.md,
    color: vars.color.textMuted,
});

export const errorText = style({
    fontSize: vars.fontSize.md,
    color: vars.color.danger,
});

export const spinner = style({
    width: "24px",
    height: "24px",
    border: `3px solid ${vars.color.border}`,
    borderTopColor: vars.color.primary,
    borderRadius: "50%",
    animation: `${spin} 0.8s linear infinite`,
});
