import { toasts, dismiss } from "./toast.js";
import * as css from "./ToastContainer.css.js";

const variantClass: Record<string, string> = {
    success: css.success,
    error: css.error,
    warning: css.warning,
    info: css.info,
};

export function ToastContainer() {
    return (
        <div class={css.container}>
            {toasts.value.map((t) => (
                <div
                    key={t.id}
                    class={`${css.toast} ${variantClass[t.variant] ?? css.info}`}
                    onClick={() => dismiss(t.id)}
                >
                    {t.message}
                </div>
            ))}
        </div>
    );
}
