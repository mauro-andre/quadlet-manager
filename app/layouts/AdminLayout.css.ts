import { style } from "@vanilla-extract/css";
import { vars, scrollable } from "../styles/theme.css.js";

export const shell = style({
    display: "flex",
    height: "100vh",
    overflow: "hidden",
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
    display: "flex",
    flexDirection: "column",
    gap: vars.space.sm,
});

export const userInfo = style({
    display: "flex",
    alignItems: "center",
    gap: vars.space.sm,
    fontSize: vars.fontSize.sm,
    color: vars.color.text,
});

export const username = style({
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
});

export const sudoBadge = style({
    display: "inline-flex",
    alignItems: "center",
    padding: `1px ${vars.space.xs}`,
    borderRadius: vars.radius.sm,
    fontSize: vars.fontSize.xs,
    fontWeight: 600,
    backgroundColor: "rgba(108, 140, 255, 0.15)",
    color: vars.color.primary,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
});

export const logoutButton = style({
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
        color: vars.color.danger,
    },
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

export const main = style([scrollable, {
    flex: 1,
    padding: vars.space.xl,
}]);
