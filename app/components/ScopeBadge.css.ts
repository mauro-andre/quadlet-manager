import { style, styleVariants } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const base = style({
    display: "inline-flex",
    alignItems: "center",
    gap: vars.space.xs,
    padding: `2px ${vars.space.sm}`,
    borderRadius: vars.radius.sm,
    fontSize: vars.fontSize.xs,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
});

const scopeColors = {
    system: {
        bg: "rgba(108, 140, 255, 0.15)",
        text: vars.color.primary,
    },
    user: {
        bg: "rgba(81, 207, 102, 0.15)",
        text: vars.color.success,
    },
};

export const variants = styleVariants(scopeColors, (colors) => ({
    backgroundColor: colors.bg,
    color: colors.text,
}));
