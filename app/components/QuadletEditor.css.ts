import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

// Toggle bar
export const toggleBar = style({
    display: "flex",
    gap: 0,
    borderRadius: vars.radius.md,
    overflow: "hidden",
    border: `1px solid ${vars.color.border}`,
    width: "fit-content",
});

export const toggleBtn = style({
    padding: `${vars.space.xs} ${vars.space.md}`,
    fontSize: vars.fontSize.sm,
    fontWeight: 500,
    border: "none",
    cursor: "pointer",
    backgroundColor: "transparent",
    color: vars.color.textMuted,
    transition: "background-color 0.15s, color 0.15s",
    ":hover": {
        backgroundColor: vars.color.bgSurfaceHover,
    },
});

export const toggleBtnActive = style({
    backgroundColor: vars.color.primary,
    color: vars.color.primaryText,
    ":hover": {
        backgroundColor: vars.color.primaryHover,
    },
});

// Section card
export const sectionCard = style({
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
});

export const sectionHeader = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderBottom: `1px solid ${vars.color.border}`,
});

export const sectionName = style({
    fontSize: vars.fontSize.md,
    fontWeight: 600,
    fontFamily: "monospace",
});

export const sectionDesc = style({
    fontSize: vars.fontSize.xs,
    color: vars.color.textMuted,
    marginLeft: vars.space.sm,
});

export const sectionRemoveBtn = style({
    padding: `${vars.space.xs} ${vars.space.sm}`,
    fontSize: vars.fontSize.sm,
    color: vars.color.danger,
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    borderRadius: vars.radius.sm,
    ":hover": {
        backgroundColor: vars.color.bgSurfaceHover,
    },
});

// Entry rows
export const entryList = style({
    display: "flex",
    flexDirection: "column",
});

export const entryRow = style({
    display: "flex",
    alignItems: "center",
    gap: vars.space.sm,
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderBottom: `1px solid ${vars.color.borderMuted}`,
    ":last-child": {
        borderBottom: "none",
    },
});

export const entryKeyLabel = style({
    fontSize: vars.fontSize.sm,
    fontWeight: 500,
    minWidth: "140px",
    flexShrink: 0,
});

export const entryDesc = style({
    fontSize: vars.fontSize.xs,
    color: vars.color.textMuted,
    minWidth: "180px",
    flexShrink: 0,
});

export const entryInput = style({
    flex: 1,
    padding: `${vars.space.xs} ${vars.space.sm}`,
    backgroundColor: vars.color.bg,
    color: vars.color.text,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.sm,
    fontSize: vars.fontSize.sm,
    outline: "none",
    minWidth: 0,
    ":focus": {
        borderColor: vars.color.primary,
    },
});

export const entrySelect = style({
    flex: 1,
    padding: `${vars.space.xs} ${vars.space.sm}`,
    backgroundColor: vars.color.bg,
    color: vars.color.text,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.sm,
    fontSize: vars.fontSize.sm,
    outline: "none",
    minWidth: 0,
    ":focus": {
        borderColor: vars.color.primary,
    },
});

export const entryKeyInput = style({
    width: "140px",
    flexShrink: 0,
    padding: `${vars.space.xs} ${vars.space.sm}`,
    backgroundColor: vars.color.bg,
    color: vars.color.text,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.sm,
    fontSize: vars.fontSize.sm,
    fontWeight: 500,
    outline: "none",
    ":focus": {
        borderColor: vars.color.primary,
    },
});

export const pairSeparator = style({
    fontSize: vars.fontSize.sm,
    color: vars.color.textMuted,
    fontWeight: 600,
    flexShrink: 0,
});

export const removeBtn = style({
    padding: vars.space.xs,
    fontSize: vars.fontSize.md,
    color: vars.color.textMuted,
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    borderRadius: vars.radius.sm,
    lineHeight: 1,
    flexShrink: 0,
    ":hover": {
        color: vars.color.danger,
        backgroundColor: vars.color.bgSurfaceHover,
    },
});

// Add directive row
export const addRow = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
});

export const addBtn = style({
    padding: `${vars.space.xs} ${vars.space.sm}`,
    fontSize: vars.fontSize.sm,
    color: vars.color.primary,
    backgroundColor: "transparent",
    border: `1px dashed ${vars.color.border}`,
    borderRadius: vars.radius.sm,
    cursor: "pointer",
    ":hover": {
        backgroundColor: vars.color.bgSurfaceHover,
        borderColor: vars.color.primary,
    },
});

// Add section button
export const addSectionBtn = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    fontSize: vars.fontSize.sm,
    color: vars.color.primary,
    backgroundColor: "transparent",
    border: `1px dashed ${vars.color.border}`,
    borderRadius: vars.radius.md,
    cursor: "pointer",
    width: "100%",
    ":hover": {
        backgroundColor: vars.color.bgSurfaceHover,
        borderColor: vars.color.primary,
    },
});

// Dropdown menu for adding directives/sections
export const dropdown = style({
    position: "absolute",
    zIndex: 100,
    backgroundColor: vars.color.bgSurface,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.md,
    boxShadow: vars.shadow.md,
    maxHeight: "280px",
    overflowY: "auto",
    minWidth: "280px",
});

export const dropdownItem = style({
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: `${vars.space.xs} ${vars.space.md}`,
    cursor: "pointer",
    fontSize: vars.fontSize.sm,
    ":hover": {
        backgroundColor: vars.color.bgSurfaceHover,
    },
});

export const dropdownItemKey = style({
    fontWeight: 500,
});

export const dropdownItemDesc = style({
    fontSize: vars.fontSize.xs,
    color: vars.color.textMuted,
});

export const dropdownWrapper = style({
    position: "relative",
    display: "inline-block",
});

// Form container
export const formContainer = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.md,
});

// Pair labels
export const pairLabel = style({
    fontSize: vars.fontSize.xs,
    color: vars.color.textMuted,
    marginBottom: "2px",
});

export const pairFieldGroup = style({
    display: "flex",
    alignItems: "center",
    gap: vars.space.xs,
    flex: 1,
    minWidth: 0,
});

export const pairField = style({
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
});
