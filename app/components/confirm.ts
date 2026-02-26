import { signal } from "@preact/signals";

export interface ConfirmState {
    message: string;
    variant: "danger" | "warning";
    confirmLabel: string;
    resolve: (value: boolean) => void;
}

export const confirmState = signal<ConfirmState | null>(null);

export function confirm(
    message: string,
    options?: { variant?: "danger" | "warning"; confirmLabel?: string },
): Promise<boolean> {
    return new Promise((resolve) => {
        confirmState.value = {
            message,
            variant: options?.variant ?? "danger",
            confirmLabel: options?.confirmLabel ?? "Confirm",
            resolve,
        };
    });
}

export function resolveConfirm(value: boolean) {
    const state = confirmState.value;
    if (state) {
        state.resolve(value);
        confirmState.value = null;
    }
}
