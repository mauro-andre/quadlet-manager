import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader, useParams } from "velojs/hooks";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import type { QuadletFile } from "../modules/quadlet/quadlet.types.js";
import { AppShell } from "../components/AppShell.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { CodeEditor } from "../components/CodeEditor.js";
import { ActionButton } from "../components/ActionButton.js";
import { LogStream } from "../components/LogStream.js";
import * as QuadletList from "./QuadletList.js";
import * as css from "./QuadletEdit.css.js";

interface QuadletEditData {
    quadlet: QuadletFile;
    activeState: string;
}

export const loader = async ({ params }: LoaderArgs) => {
    const { getQuadlet } = await import(
        "../modules/quadlet/quadlet.service.js"
    );
    const { getServiceStatus } = await import(
        "../modules/systemd/systemd.service.js"
    );

    const quadlet = await getQuadlet(params.name!);
    const status = await getServiceStatus(quadlet.serviceName);

    return {
        quadlet,
        activeState: status.activeState,
    } satisfies QuadletEditData;
};

export const action_save = async ({
    body,
}: ActionArgs<{ filename: string; content: string }>) => {
    const { saveQuadlet } = await import(
        "../modules/quadlet/quadlet.service.js"
    );
    await saveQuadlet(body.filename, body.content);
    return { ok: true };
};

export const action_start = async ({
    body,
}: ActionArgs<{ serviceName: string }>) => {
    const { startService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    await startService(body.serviceName);
    return { ok: true };
};

export const action_stop = async ({
    body,
}: ActionArgs<{ serviceName: string }>) => {
    const { stopService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    await stopService(body.serviceName);
    return { ok: true };
};

export const action_restart = async ({
    body,
}: ActionArgs<{ serviceName: string }>) => {
    const { restartService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    await restartService(body.serviceName);
    return { ok: true };
};

export const Component = () => {
    const params = useParams<{ name: string }>();
    const { data, loading } = useLoader<QuadletEditData>([params.name]);
    const content = useSignal("");

    useEffect(() => {
        if (data.value?.quadlet) {
            content.value = data.value.quadlet.content;
        }
    }, [data.value?.quadlet]);

    if (loading.value) return <AppShell>Loading...</AppShell>;
    if (!data.value) return <AppShell>Quadlet not found</AppShell>;

    const { quadlet, activeState } = data.value;
    const isActive = activeState === "active";
    const reload = () => window.location.reload();

    return (
        <AppShell>
            <div class={css.page}>
                <Link to={QuadletList} class={css.backLink}>
                    Back to Quadlets
                </Link>

                <div class={css.header}>
                    <h1 class={css.title}>{quadlet.filename}</h1>
                    <StatusBadge status={activeState} />
                    <div class={css.actions}>
                        {isActive ? (
                            <>
                                <ActionButton
                                    label="Stop"
                                    onClick={() =>
                                        action_stop({
                                            body: {
                                                serviceName:
                                                    quadlet.serviceName,
                                            },
                                        }).then(reload)
                                    }
                                />
                                <ActionButton
                                    label="Restart"
                                    onClick={() =>
                                        action_restart({
                                            body: {
                                                serviceName:
                                                    quadlet.serviceName,
                                            },
                                        }).then(reload)
                                    }
                                />
                            </>
                        ) : (
                            <ActionButton
                                label="Start"
                                variant="primary"
                                onClick={() =>
                                    action_start({
                                        body: {
                                            serviceName:
                                                quadlet.serviceName,
                                        },
                                    }).then(reload)
                                }
                            />
                        )}
                        <ActionButton
                            label="Save"
                            variant="primary"
                            onClick={() =>
                                action_save({
                                    body: {
                                        filename: quadlet.filename,
                                        content: content.value,
                                    },
                                })
                            }
                        />
                    </div>
                </div>

                <CodeEditor value={content} />

                <LogStream
                    url={`/api/logs/service/${encodeURIComponent(quadlet.serviceName)}`}
                    title="Service Logs"
                />
            </div>
        </AppShell>
    );
};
