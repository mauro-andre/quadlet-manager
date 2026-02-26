import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const shell = style({
    display: "flex",
    minHeight: "100vh",
});

export const sidebar = style({
    width: "240px",
    backgroundColor: vars.color.bgSurface,
    borderRight: `1px solid ${vars.color.border}`,
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
});

export const logo = style({
    padding: `${vars.space.lg} ${vars.space.md}`,
    fontSize: vars.fontSize.lg,
    fontWeight: 700,
    borderBottom: `1px solid ${vars.color.border}`,
});

export const nav = style({
    display: "flex",
    flexDirection: "column",
    padding: vars.space.sm,
    gap: vars.space.xs,
    flex: 1,
});

export const navLink = style({
    display: "flex",
    alignItems: "center",
    gap: vars.space.sm,
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderRadius: vars.radius.md,
    color: vars.color.textMuted,
    fontSize: vars.fontSize.md,
    transition: "background-color 0.15s, color 0.15s",
    ":hover": {
        backgroundColor: vars.color.bgSurfaceHover,
        color: vars.color.text,
    },
});

export const navLinkActive = style({
    backgroundColor: vars.color.bgSurfaceActive,
    color: vars.color.text,
});

export const sidebarFooter = style({
    padding: vars.space.md,
    borderTop: `1px solid ${vars.color.border}`,
});

export const themeToggle = style({
    display: "flex",
    alignItems: "center",
    gap: vars.space.sm,
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderRadius: vars.radius.md,
    color: vars.color.textMuted,
    fontSize: vars.fontSize.sm,
    width: "100%",
    transition: "background-color 0.15s, color 0.15s",
    ":hover": {
        backgroundColor: vars.color.bgSurfaceHover,
        color: vars.color.text,
    },
});

export const main = style({
    flex: 1,
    padding: vars.space.xl,
    overflow: "auto",
});
