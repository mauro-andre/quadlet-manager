export interface PullEvent {
    pullId: string;
    reference: string;
    type: "progress" | "complete" | "error";
    message: string;
    timestamp: number;
}

export interface ActivePull {
    pullId: string;
    reference: string;
    startedAt: number;
    lastMessage: string;
}

type Listener = (event: PullEvent) => void;

class PullStore {
    private listeners: Listener[] = [];
    private activePulls = new Map<string, ActivePull>();
    private pullCounter = 0;

    createPull(reference: string): string {
        const pullId = `pull-${++this.pullCounter}-${Date.now()}`;
        this.activePulls.set(pullId, {
            pullId,
            reference,
            startedAt: Date.now(),
            lastMessage: "Starting pull...",
        });
        return pullId;
    }

    emit(event: PullEvent): void {
        const active = this.activePulls.get(event.pullId);
        if (active && event.message) {
            active.lastMessage = event.message;
        }

        if (event.type === "complete" || event.type === "error") {
            this.activePulls.delete(event.pullId);
        }

        for (const fn of this.listeners) {
            fn(event);
        }
    }

    getActivePulls(): ActivePull[] {
        return Array.from(this.activePulls.values());
    }

    subscribe(fn: Listener): () => void {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== fn);
        };
    }
}

export const pullStore = new PullStore();
