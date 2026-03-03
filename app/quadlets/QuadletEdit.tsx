import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader, useParams } from "velojs/hooks";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import type { QuadletFile } from "../modules/quadlet/quadlet.types.js";
import type { Scope } from "../modules/auth/auth.types.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { ScopeBadge } from "../components/ScopeBadge.js";
import { QuadletEditor } from "../components/QuadletEditor.js";
import { ActionButton } from "../components/ActionButton.js";
import { LogStream } from "../components/LogStream.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import * as QuadletList from "./QuadletList.js";
import * as css from "./QuadletEdit.css.js";

interface QuadletEditData {
    quadlet: QuadletFile;
    activeState: string;
}

export const loader = async ({ params, query, c }: LoaderArgs) => {
    const { getQuadlet } = await import(
        "../modules/quadlet/quadlet.service.js"
    );
    const { getServiceStatus } = await import(
        "../modules/systemd/systemd.service.js"
    );

    const user = c.get("user");
    const scope: Scope = query.scope === "system" ? "system" : "user";
    const quadlet = await getQuadlet(params.name!, scope, user);
    const status = await getServiceStatus(quadlet.serviceName, scope);

    return {
        quadlet,
        activeState: status.activeState,
    } satisfies QuadletEditData;
};

export const action_save = async ({
    body, c,
}: ActionArgs<{ filename: string; content: string; scope: Scope }>) => {
    const { saveQuadlet } = await import(
        "../modules/quadlet/quadlet.service.js"
    );
    const user = c!.get("user");
    await saveQuadlet(body.filename, body.content, body.scope, user);
    return { ok: true };
};

export const action_start = async ({
    body,
}: ActionArgs<{ serviceName: string; scope: Scope }>) => {
    const { startService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    await startService(body.serviceName, body.scope);
    return { ok: true };
};

export const action_stop = async ({
    body,
}: ActionArgs<{ serviceName: string; scope: Scope }>) => {
    const { stopService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    await stopService(body.serviceName, body.scope);
    return { ok: true };
};

export const action_restart = async ({
    body,
}: ActionArgs<{ serviceName: string; scope: Scope }>) => {
    const { restartService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    await restartService(body.serviceName, body.scope);
    return { ok: true };
};

export const Component = () => {
    const params = useParams<{ name: string }>();
    const { data, loading, refetch } = useLoader<QuadletEditData>([params.name]);
    const content = useSignal("");

    useEffect(() => {
        if (data.value?.quadlet) {
            content.value = data.value.quadlet.content;
        }
    }, [data.value?.quadlet]);

    if (loading.value) return <div>Loading...</div>;
    if (!data.value) return <div>Quadlet not found</div>;

    const { quadlet, activeState } = data.value;
    const isActive = activeState === "active";
    const scope = quadlet.scope;

    const run = (action: Promise<unknown>, msg: string) =>
        action
            .then(() => { toast(msg); refetch(); })
            .catch(() => toast("Action failed", "error"));

    return (
        <div class={css.page}>
                <Link to={QuadletList} class={css.backLink}>
                    Back to Quadlets
                </Link>

                <div class={css.header}>
                    <h1 class={css.title}>{quadlet.filename}</h1>
                    <ScopeBadge scope={scope} />
                    <StatusBadge status={activeState} />
                    <div class={css.actions}>
                        {isActive ? (
                            <>
                                <ActionButton
                                    label="Stop"
                                    onClick={async () => {
                                        if (await confirm(`Stop ${quadlet.filename}?`, { variant: "warning", confirmLabel: "Stop" }))
                                            run(action_stop({ body: { serviceName: quadlet.serviceName, scope } }), "Service stopped");
                                    }}
                                />
                                <ActionButton
                                    label="Restart"
                                    onClick={() =>
                                        run(
                                            action_restart({ body: { serviceName: quadlet.serviceName, scope } }),
                                            "Service restarted"
                                        )
                                    }
                                />
                            </>
                        ) : (
                            <ActionButton
                                label="Start"
                                variant="primary"
                                onClick={() =>
                                    run(
                                        action_start({ body: { serviceName: quadlet.serviceName, scope } }),
                                        "Service started"
                                    )
                                }
                            />
                        )}
                        <ActionButton
                            label="Save"
                            variant="primary"
                            onClick={() =>
                                run(
                                    action_save({ body: { filename: quadlet.filename, content: content.value, scope } }),
                                    "Quadlet saved"
                                )
                            }
                        />
                    </div>
                </div>

                <QuadletEditor content={content} />

                <LogStream
                    url={`/api/logs/service/${encodeURIComponent(quadlet.serviceName)}?scope=${scope}`}
                    title="Service Logs"
                />
        </div>
    );
};
