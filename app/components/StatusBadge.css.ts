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

export const dot = style({
    width: "6px",
    height: "6px",
    borderRadius: "50%",
});

const statusColors = {
    running: {
        bg: "rgba(81, 207, 102, 0.15)",
        text: vars.color.success,
    },
    exited: {
        bg: "rgba(139, 144, 160, 0.15)",
        text: vars.color.textMuted,
    },
    created: {
        bg: "rgba(252, 196, 25, 0.15)",
        text: vars.color.warning,
    },
    paused: {
        bg: "rgba(252, 196, 25, 0.15)",
        text: vars.color.warning,
    },
    failed: {
        bg: "rgba(255, 107, 107, 0.15)",
        text: vars.color.danger,
    },
    unknown: {
        bg: "rgba(139, 144, 160, 0.15)",
        text: vars.color.textMuted,
    },
};

export const variants = styleVariants(statusColors, (colors) => ({
    backgroundColor: colors.bg,
    color: colors.text,
}));

export const dotVariants = styleVariants(statusColors, (colors) => ({
    backgroundColor: colors.text,
}));
