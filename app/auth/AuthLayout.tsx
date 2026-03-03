import type { ComponentChildren } from "preact";
import * as css from "./AuthLayout.css.js";

export const Component = ({ children }: { children?: ComponentChildren }) => {
    return <div class={css.shell}>{children}</div>;
};
