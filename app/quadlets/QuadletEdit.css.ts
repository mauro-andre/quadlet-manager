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
    gap: vars.space.md,
    flexWrap: "wrap",
});

export const actions = style({
    display: "flex",
    gap: vars.space.sm,
    marginLeft: "auto",
});

export const title = style({
    fontSize: vars.fontSize.xxl,
    fontWeight: 700,
    flex: 1,
});

export const backLink = style({
    color: vars.color.primary,
    fontSize: vars.fontSize.sm,
    ":hover": {
        textDecoration: "underline",
    },
});

