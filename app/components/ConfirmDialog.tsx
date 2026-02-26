import { useEffect } from "preact/hooks";
import { confirmState, resolveConfirm } from "./confirm.js";
import * as css from "./ConfirmDialog.css.js";

export function ConfirmDialog() {
    const state = confirmState.value;

    useEffect(() => {
        if (!state) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") resolveConfirm(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [state]);

    if (!state) return null;

    return (
        <>
            <div class={css.overlay} onClick={() => resolveConfirm(false)} />
            <div class={css.dialog}>
                <div class={css.message}>{state.message}</div>
                <div class={css.actions}>
                    <button
                        class={css.cancelButton}
                        onClick={() => resolveConfirm(false)}
                    >
                        Cancel
                    </button>
                    <button
                        class={`${css.confirmButton} ${state.variant === "warning" ? css.confirmButtonWarning : ""}`}
                        onClick={() => resolveConfirm(true)}
                    >
                        {state.confirmLabel}
                    </button>
                </div>
            </div>
        </>
    );
}
