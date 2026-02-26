import { useSignal } from "@preact/signals";
import * as css from "./ActionButton.css.js";

interface ActionButtonProps {
    label: string;
    onClick: () => Promise<unknown>;
    variant?: "primary" | "danger" | "default";
}

export function ActionButton({
    label,
    onClick,
    variant = "default",
}: ActionButtonProps) {
    const loading = useSignal(false);

    const handleClick = async () => {
        if (loading.value) return;
        loading.value = true;
        try {
            await onClick();
        } finally {
            loading.value = false;
        }
    };

    return (
        <button
            class={`${css.base} ${css.variants[variant]}`}
            onClick={handleClick}
            disabled={loading.value}
        >
            {loading.value && <span class={css.spinner} />}
            {label}
        </button>
    );
}
