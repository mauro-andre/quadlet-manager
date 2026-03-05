import { style, keyframes } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const page = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.lg,
});

export const header = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
});

export const title = style({
    fontSize: vars.fontSize.xxl,
    fontWeight: 700,
});

export const headerRight = style({
    display: "flex",
    alignItems: "center",
    gap: vars.space.sm,
});

// ── Setup card (no storage) ──────────────────────────────────

export const setupCard = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    padding: vars.space.xxl,
    textAlign: "center",
    maxWidth: "560px",
    margin: "0 auto",
    marginTop: vars.space.xxl,
});

export const setupTitle = style({
    fontSize: vars.fontSize.xl,
    fontWeight: 700,
    marginBottom: vars.space.sm,
});

export const setupDescription = style({
    color: vars.color.textMuted,
    fontSize: vars.fontSize.md,
    lineHeight: "1.6",
    marginBottom: vars.space.lg,
});

export const setupButton = style({
    display: "inline-flex",
    alignItems: "center",
    padding: `${vars.space.sm} ${vars.space.lg}`,
    backgroundColor: vars.color.primary,
    color: vars.color.primaryText,
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.md,
    fontWeight: 500,
    border: "none",
    cursor: "pointer",
    ":hover": {
        backgroundColor: vars.color.primaryHover,
    },
});

// ── Warning box ──────────────────────────────────────────────

export const warningBox = style({
    backgroundColor: "rgba(252, 196, 25, 0.1)",
    border: `1px solid ${vars.color.warning}`,
    borderRadius: vars.radius.md,
    padding: vars.space.md,
    fontSize: vars.fontSize.sm,
    lineHeight: "1.5",
    marginBottom: vars.space.lg,
});

export const warningCode = style({
    display: "block",
    fontFamily: "monospace",
    backgroundColor: vars.color.bgSurfaceActive,
    padding: vars.space.sm,
    borderRadius: vars.radius.sm,
    marginTop: vars.space.sm,
    fontSize: vars.fontSize.xs,
});

// ── Section titles ───────────────────────────────────────────

export const sectionHeader = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
});

export const sectionTitle = style({
    fontSize: vars.fontSize.lg,
    fontWeight: 600,
});

// ── Storage cards ────────────────────────────────────────────

export const cardList = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.sm,
});

export const card = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.md,
    padding: vars.space.md,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
});

export const cardInfo = style({
    display: "flex",
    flexDirection: "column",
    gap: "2px",
});

export const cardName = style({
    fontWeight: 600,
    fontSize: vars.fontSize.md,
});

export const cardDetail = style({
    fontSize: vars.fontSize.sm,
    color: vars.color.textMuted,
    fontFamily: "monospace",
});

export const cardMeta = style({
    display: "flex",
    alignItems: "center",
    gap: vars.space.sm,
    fontSize: vars.fontSize.xs,
    color: vars.color.textMuted,
    marginTop: vars.space.xs,
});

export const cardDisabled = style({
    opacity: 0.5,
});

// ── Inline forms ─────────────────────────────────────────────

export const inlineForm = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.primary}`,
    borderRadius: vars.radius.lg,
    padding: vars.space.md,
});

export const inlineFormTitle = style({
    fontSize: vars.fontSize.md,
    fontWeight: 600,
    marginBottom: vars.space.md,
});

export const inlineFormRow = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: vars.space.md,
});

export const inlineFormField = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.xs,
});

export const inlineFormLabel = style({
    fontSize: vars.fontSize.xs,
    fontWeight: 600,
    color: vars.color.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
});

export const input = style({
    padding: `${vars.space.xs} ${vars.space.sm}`,
    backgroundColor: vars.color.bg,
    color: vars.color.text,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.md,
    "::placeholder": {
        color: vars.color.textMuted,
    },
});

export const select = style({
    padding: `${vars.space.xs} ${vars.space.sm}`,
    backgroundColor: vars.color.bg,
    color: vars.color.text,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.md,
});

export const inlineFormActions = style({
    display: "flex",
    gap: vars.space.sm,
    justifyContent: "flex-end",
    marginTop: vars.space.md,
});

// ── Buttons ──────────────────────────────────────────────────

export const addButton = style({
    display: "inline-flex",
    alignItems: "center",
    padding: `${vars.space.sm} ${vars.space.md}`,
    backgroundColor: vars.color.primary,
    color: vars.color.primaryText,
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.sm,
    fontWeight: 500,
    border: "none",
    cursor: "pointer",
    ":hover": {
        backgroundColor: vars.color.primaryHover,
    },
});

export const cancelButton = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    backgroundColor: "transparent",
    color: vars.color.textMuted,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.sm,
    fontWeight: 500,
    cursor: "pointer",
    ":hover": {
        backgroundColor: vars.color.bgSurfaceHover,
    },
});

export const submitButton = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    backgroundColor: vars.color.primary,
    color: vars.color.primaryText,
    border: "none",
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.sm,
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

// ── Table (history) ──────────────────────────────────────────

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

export const actionsCell = style({
    display: "flex",
    gap: vars.space.sm,
});

export const empty = style({
    padding: vars.space.xl,
    textAlign: "center",
    color: vars.color.textMuted,
});

// ── Status badges ────────────────────────────────────────────

export const statusBadge = style({
    display: "inline-flex",
    alignItems: "center",
    gap: vars.space.xs,
    padding: `2px ${vars.space.sm}`,
    borderRadius: vars.radius.sm,
    fontSize: vars.fontSize.xs,
    fontWeight: 600,
});

export const statusSuccess = style({
    backgroundColor: "rgba(81, 207, 102, 0.15)",
    color: vars.color.success,
});

export const statusError = style({
    backgroundColor: "rgba(255, 107, 107, 0.15)",
    color: vars.color.danger,
});

export const statusRunning = style({
    backgroundColor: "rgba(108, 140, 255, 0.15)",
    color: vars.color.primary,
});

const spin = keyframes({
    to: { transform: "rotate(360deg)" },
});

export const spinner = style({
    display: "inline-block",
    width: "10px",
    height: "10px",
    border: `2px solid ${vars.color.border}`,
    borderTopColor: vars.color.primary,
    borderRadius: "50%",
    animation: `${spin} 0.8s linear infinite`,
});

export const policyHistory = style({
    backgroundColor: vars.color.bgSurface,
    borderLeft: `1px solid ${vars.color.border}`,
    borderRight: `1px solid ${vars.color.border}`,
    borderBottom: `1px solid ${vars.color.border}`,
    borderRadius: `0 0 ${vars.radius.md} ${vars.radius.md}`,
    overflow: "hidden",
});

export const runningButton = style({
    display: "inline-flex",
    alignItems: "center",
    gap: vars.space.xs,
    padding: `${vars.space.xs} ${vars.space.sm}`,
    backgroundColor: "rgba(108, 140, 255, 0.1)",
    color: vars.color.primary,
    border: `1px solid ${vars.color.primary}`,
    borderRadius: vars.radius.sm,
    fontSize: vars.fontSize.xs,
    fontWeight: 600,
    cursor: "default",
    opacity: 0.9,
});

export const errorDetail = style({
    fontSize: vars.fontSize.xs,
    color: vars.color.danger,
    marginTop: vars.space.xs,
    maxWidth: "400px",
    wordBreak: "break-word",
});
