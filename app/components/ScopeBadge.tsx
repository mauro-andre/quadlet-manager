import type { Scope } from "../modules/auth/auth.types.js";
import * as css from "./ScopeBadge.css.js";

export function ScopeBadge({ scope }: { scope: Scope }) {
    return (
        <span class={`${css.base} ${css.variants[scope]}`}>
            {scope}
        </span>
    );
}
