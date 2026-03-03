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
    justifyContent: "space-between",
});

export const title = style({
    fontSize: vars.fontSize.xxl,
    fontWeight: 700,
});

export const headerRight = style({
    display: "flex",
    alignItems: "center",
    gap: vars.space.md,
});

export const statusBadge = style({
    display: "inline-flex",
    alignItems: "center",
    gap: vars.space.xs,
    padding: `2px ${vars.space.sm}`,
    borderRadius: vars.radius.sm,
    fontSize: vars.fontSize.xs,
    fontWeight: 600,
});

export const statusActive = style({
    backgroundColor: "rgba(81, 207, 102, 0.15)",
    color: vars.color.success,
});

export const statusInactive = style({
    backgroundColor: vars.color.bgSurfaceActive,
    color: vars.color.textMuted,
});

export const statusDot = style({
    width: "6px",
    height: "6px",
    borderRadius: "50%",
});

export const statusDotActive = style({
    backgroundColor: vars.color.success,
});

export const statusDotInactive = style({
    backgroundColor: vars.color.textMuted,
});

// ── Enable card (disabled state) ──────────────────────────────

export const enableCard = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    padding: vars.space.xxl,
    textAlign: "center",
    maxWidth: "560px",
    margin: "0 auto",
    marginTop: vars.space.xxl,
});

export const enableTitle = style({
    fontSize: vars.fontSize.xl,
    fontWeight: 700,
    marginBottom: vars.space.sm,
});

export const enableDescription = style({
    color: vars.color.textMuted,
    fontSize: vars.fontSize.md,
    lineHeight: "1.6",
    marginBottom: vars.space.lg,
});

export const enableButton = style({
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

// ── Setup form ────────────────────────────────────────────────

export const setupCard = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    padding: vars.space.xl,
    maxWidth: "560px",
    margin: "0 auto",
    marginTop: vars.space.xxl,
});

export const setupTitle = style({
    fontSize: vars.fontSize.xl,
    fontWeight: 700,
    marginBottom: vars.space.lg,
});

export const warningBox = style({
    backgroundColor: "rgba(252, 196, 25, 0.1)",
    border: `1px solid ${vars.color.warning}`,
    borderRadius: vars.radius.md,
    padding: vars.space.md,
    marginBottom: vars.space.lg,
    fontSize: vars.fontSize.sm,
    lineHeight: "1.5",
});

export const warningTitle = style({
    fontWeight: 600,
    color: vars.color.warning,
    marginBottom: vars.space.xs,
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

export const checkAgainButton = style({
    display: "inline-flex",
    alignItems: "center",
    padding: `${vars.space.xs} ${vars.space.sm}`,
    backgroundColor: "transparent",
    color: vars.color.warning,
    border: `1px solid ${vars.color.warning}`,
    borderRadius: vars.radius.sm,
    fontSize: vars.fontSize.xs,
    fontWeight: 500,
    cursor: "pointer",
    marginTop: vars.space.sm,
    ":hover": {
        backgroundColor: "rgba(252, 196, 25, 0.1)",
    },
});

export const formGroup = style({
    marginBottom: vars.space.lg,
});

export const label = style({
    display: "block",
    fontSize: vars.fontSize.sm,
    fontWeight: 600,
    marginBottom: vars.space.sm,
    color: vars.color.text,
});

export const radioGroup = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.sm,
});

export const radioOption = style({
    display: "flex",
    alignItems: "flex-start",
    gap: vars.space.sm,
    padding: vars.space.sm,
    borderRadius: vars.radius.md,
    cursor: "pointer",
    ":hover": {
        backgroundColor: vars.color.bgSurfaceHover,
    },
});

export const radioOptionSelected = style({
    backgroundColor: vars.color.bgSurfaceActive,
});

export const radioLabel = style({
    fontSize: vars.fontSize.md,
    fontWeight: 500,
});

export const radioDescription = style({
    fontSize: vars.fontSize.sm,
    color: vars.color.textMuted,
    marginTop: "2px",
});

export const textarea = style({
    width: "100%",
    minHeight: "120px",
    padding: vars.space.sm,
    backgroundColor: vars.color.bg,
    color: vars.color.text,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.md,
    fontFamily: "monospace",
    fontSize: vars.fontSize.sm,
    resize: "vertical",
    marginTop: vars.space.sm,
    "::placeholder": {
        color: vars.color.textMuted,
    },
});

export const formActions = style({
    display: "flex",
    justifyContent: "flex-end",
    gap: vars.space.sm,
    marginTop: vars.space.lg,
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

// ── Domain table ──────────────────────────────────────────────

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

export const domainName = style({
    fontWeight: 500,
    color: vars.color.primary,
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

export const networkWarning = style({
    display: "flex",
    alignItems: "center",
    gap: vars.space.xs,
    fontSize: vars.fontSize.xs,
    color: vars.color.warning,
    marginTop: "2px",
});

// ── Inline add/edit form ──────────────────────────────────────

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
    display: "flex",
    gap: vars.space.md,
    alignItems: "flex-end",
    flexWrap: "wrap",
});

export const inlineFormField = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.xs,
    flex: 1,
    minWidth: "160px",
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
    alignItems: "flex-end",
    paddingBottom: "1px",
});

// ── Settings section ──────────────────────────────────────────

export const settingsSection = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    padding: vars.space.lg,
});

export const settingsTitle = style({
    fontSize: vars.fontSize.lg,
    fontWeight: 600,
    marginBottom: vars.space.md,
});

export const settingsRow = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${vars.space.sm} 0`,
    borderBottom: `1px solid ${vars.color.borderMuted}`,
    selectors: {
        "&:last-child": {
            borderBottom: "none",
        },
    },
});

export const settingsLabel = style({
    fontSize: vars.fontSize.md,
    color: vars.color.textMuted,
});

export const settingsValue = style({
    fontSize: vars.fontSize.md,
    fontWeight: 500,
});

export const disableButton = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    backgroundColor: vars.color.danger,
    color: vars.color.dangerText,
    border: "none",
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.sm,
    fontWeight: 500,
    cursor: "pointer",
    ":hover": {
        backgroundColor: vars.color.dangerHover,
    },
});

export const disabledBadge = style({
    fontSize: vars.fontSize.xs,
    color: vars.color.textMuted,
    padding: `2px ${vars.space.sm}`,
    backgroundColor: vars.color.bgSurfaceActive,
    borderRadius: vars.radius.sm,
});
