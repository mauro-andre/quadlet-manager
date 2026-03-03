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

export const registryName = style({
    fontWeight: 500,
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

// ── Inline add form ──────────────────────────────────────────

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

export const helperText = style({
    fontSize: vars.fontSize.xs,
    color: vars.color.textMuted,
    marginTop: "2px",
});

export const inlineFormActions = style({
    display: "flex",
    gap: vars.space.sm,
    justifyContent: "flex-end",
    marginTop: vars.space.md,
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
