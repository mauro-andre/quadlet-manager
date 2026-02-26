import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const wrapper = style({
    display: "flex",
    flexDirection: "column",
    gap: vars.space.sm,
    flex: 1,
});

export const textarea = style({
    width: "100%",
    minHeight: "400px",
    padding: vars.space.md,
    backgroundColor: vars.color.bg,
    color: vars.color.text,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.md,
    fontSize: vars.fontSize.md,
    lineHeight: 1.6,
    resize: "vertical",
    outline: "none",
    ":focus": {
        borderColor: vars.color.primary,
    },
});
