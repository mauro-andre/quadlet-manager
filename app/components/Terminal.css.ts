import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const terminalContainer = style({
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
    backgroundColor: "#000",
});

export const terminalPage = style({
    display: "flex",
    flexDirection: "column",
    height: "calc(100vh - 64px)",
    gap: vars.space.md,
});

export const tabs = style({
    display: "flex",
    gap: vars.space.sm,
    borderBottom: `1px solid ${vars.color.border}`,
    paddingBottom: vars.space.sm,
});

export const tab = style({
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

export const tabActive = style({
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.md,
    backgroundColor: vars.color.bgSurfaceActive,
    color: vars.color.text,
    fontWeight: 600,
});

export const exitMessage = style({
    padding: vars.space.md,
    color: vars.color.textMuted,
    fontSize: vars.fontSize.sm,
    textAlign: "center",
});
