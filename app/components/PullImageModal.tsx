import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { pullModalOpen, closePullModal } from "./pullImageModal.js";
import { toast } from "./toast.js";
import * as css from "./PullImageModal.css.js";

export function PullImageModal() {
    const reference = useSignal("");
    const submitting = useSignal(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!pullModalOpen.value) return;
        setTimeout(() => inputRef.current?.focus(), 50);

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closePullModal();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [pullModalOpen.value]);

    if (!pullModalOpen.value) return null;

    const handleSubmit = async () => {
        const ref = reference.value.trim();
        if (!ref || submitting.value) return;

        submitting.value = true;
        try {
            const res = await fetch("/api/images/pull", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reference: ref }),
            });
            if (!res.ok) throw new Error("Failed to start pull");

            toast(`Pulling ${ref}...`, "info");
            reference.value = "";
            closePullModal();
        } catch {
            toast("Failed to start image pull", "error");
        } finally {
            submitting.value = false;
        }
    };

    return (
        <>
            <div class={css.overlay} onClick={closePullModal} />
            <div class={css.dialog}>
                <div class={css.title}>Pull Image</div>
                <input
                    ref={inputRef}
                    type="text"
                    class={css.input}
                    placeholder="e.g. docker.io/library/nginx:latest"
                    value={reference.value}
                    onInput={(e) => { reference.value = (e.target as HTMLInputElement).value; }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                />
                <div class={css.actions}>
                    <button class={css.cancelButton} onClick={closePullModal}>
                        Cancel
                    </button>
                    <button
                        class={css.pullButton}
                        onClick={handleSubmit}
                        disabled={submitting.value || !reference.value.trim()}
                    >
                        {submitting.value ? "Starting..." : "Pull"}
                    </button>
                </div>
            </div>
        </>
    );
}
