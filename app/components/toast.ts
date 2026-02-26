import { signal } from "@preact/signals";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
    id: number;
    message: string;
    variant: ToastVariant;
}

let nextId = 0;

export const toasts = signal<Toast[]>([]);

export function toast(message: string, variant: ToastVariant = "success") {
    const id = ++nextId;
    toasts.value = [...toasts.value, { id, message, variant }];

    setTimeout(() => {
        dismiss(id);
    }, 4000);
}

export function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
}
