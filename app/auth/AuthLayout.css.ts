import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const shell = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    padding: vars.space.md,
});
