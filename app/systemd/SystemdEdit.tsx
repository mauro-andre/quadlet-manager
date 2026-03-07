import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader, useParams } from "velojs/hooks";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import type { SystemdUnitFile } from "../modules/systemd/systemd-unit.service.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { QuadletEditor, type SectionsConfig } from "../components/QuadletEditor.js";
import { ActionButton } from "../components/ActionButton.js";
import { LogStream } from "../components/LogStream.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import {
    SYSTEMD_SECTIONS,
    getSystemdSectionSpec,
    getSystemdDirectiveSpec,
} from "../modules/systemd/systemd.directives.js";
import * as SystemdList from "./SystemdList.js";
import * as css from "../quadlets/QuadletEdit.css.js";

const systemdConfig: SectionsConfig = {
    allSections: SYSTEMD_SECTIONS,
    getSectionSpec: getSystemdSectionSpec,
    getDirectiveSpec: getSystemdDirectiveSpec,
};

interface SystemdEditData {
    unit: SystemdUnitFile;
    activeState: string;
}

export const loader = async ({ params, c }: LoaderArgs) => {
    const { getUnit } = await import(
        "../modules/systemd/systemd-unit.service.js"
    );
    const { getServiceStatus } = await import(
        "../modules/systemd/systemd.service.js"
    );

    const user = c.get("user");
    const unit = await getUnit(params.name!, user);
    const status = await getServiceStatus(unit.serviceName);

    return {
        unit,
        activeState: status.activeState,
    } satisfies SystemdEditData;
};

export const action_save = async ({
    body, c,
}: ActionArgs<{ filename: string; content: string }>) => {
    const { saveUnit } = await import(
        "../modules/systemd/systemd-unit.service.js"
    );
    const user = c!.get("user");
    await saveUnit(body.filename, body.content, user);
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

export const action_enable = async ({
    body,
}: ActionArgs<{ serviceName: string }>) => {
    const { enableService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    await enableService(body.serviceName);
    return { ok: true };
};

export const action_disable = async ({
    body,
}: ActionArgs<{ serviceName: string }>) => {
    const { disableService } = await import(
        "../modules/systemd/systemd.service.js"
    );
    await disableService(body.serviceName);
    return { ok: true };
};

export const Component = () => {
    const params = useParams<{ name: string }>();
    const { data, loading, refetch } = useLoader<SystemdEditData>([params.name]);
    const content = useSignal("");

    useEffect(() => {
        if (data.value?.unit) {
            content.value = data.value.unit.content;
        }
    }, [data.value?.unit]);

    if (loading.value) return <div>Loading...</div>;
    if (!data.value) return <div>Unit not found</div>;

    const { unit, activeState } = data.value;
    const isActive = activeState === "active";

    const run = (action: Promise<unknown>, msg: string) =>
        action
            .then((result) => {
                if (result && typeof result === "object" && "error" in result) {
                    toast(String((result as { error: string }).error), "error");
                    return;
                }
                toast(msg); refetch();
            })
            .catch(() => toast("Action failed", "error"));

    return (
        <div class={css.page}>
                <Link to={SystemdList} class={css.backLink}>
                    Back to Systemd
                </Link>

                <div class={css.header}>
                    <h1 class={css.title}>{unit.filename}</h1>
                    <StatusBadge status={activeState} />
                    <div class={css.actions}>
                        {isActive ? (
                            <>
                                <ActionButton
                                    label="Stop"
                                    onClick={async () => {
                                        if (await confirm(`Stop ${unit.filename}?`, { variant: "warning", confirmLabel: "Stop" }))
                                            run(action_stop({ body: { serviceName: unit.serviceName } }), "Unit stopped");
                                    }}
                                />
                                <ActionButton
                                    label="Restart"
                                    onClick={() =>
                                        run(
                                            action_restart({ body: { serviceName: unit.serviceName } }),
                                            "Unit restarted"
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
                                        action_start({ body: { serviceName: unit.serviceName } }),
                                        "Unit started"
                                    )
                                }
                            />
                        )}
                        <ActionButton
                            label="Enable"
                            onClick={() =>
                                run(
                                    action_enable({ body: { serviceName: unit.serviceName } }),
                                    "Unit enabled"
                                )
                            }
                        />
                        <ActionButton
                            label="Save"
                            variant="primary"
                            onClick={() =>
                                run(
                                    action_save({ body: { filename: unit.filename, content: content.value } }),
                                    "Unit saved"
                                )
                            }
                        />
                    </div>
                </div>

                <QuadletEditor
                    content={content}
                    sectionsConfig={systemdConfig}
                    fetchResources={false}
                />

                <LogStream
                    url={`/api/logs/service/${encodeURIComponent(unit.serviceName)}`}
                    title="Unit Logs"
                />
        </div>
    );
};
