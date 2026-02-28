import { signal } from "@preact/signals";

export const pullModalOpen = signal(false);

export function openPullModal() {
    pullModalOpen.value = true;
}

export function closePullModal() {
    pullModalOpen.value = false;
}
