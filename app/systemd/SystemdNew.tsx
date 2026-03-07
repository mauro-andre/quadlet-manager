import type { ActionArgs } from "velojs";
import { Link } from "velojs";
import { useNavigate } from "velojs/hooks";
import { useSignal } from "@preact/signals";
import { QuadletEditor, type SectionsConfig } from "../components/QuadletEditor.js";
import { ActionButton } from "../components/ActionButton.js";
import { toast } from "../components/toast.js";
import {
    SYSTEMD_SECTIONS,
    getSystemdSectionSpec,
    getSystemdDirectiveSpec,
} from "../modules/systemd/systemd.directives.js";
import * as SystemdList from "./SystemdList.js";
import * as css from "../quadlets/QuadletNew.css.js";

const systemdConfig: SectionsConfig = {
    allSections: SYSTEMD_SECTIONS,
    getSectionSpec: getSystemdSectionSpec,
    getDirectiveSpec: getSystemdDirectiveSpec,
};

const TEMPLATES: Record<string, string> = {
    service: `[Unit]
Description=

[Service]
Type=oneshot
ExecStart=

[Install]
WantedBy=default.target
`,
    timer: `[Unit]
Description=

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
`,
};

export const action_create = async ({
    body, c,
}: ActionArgs<{ filename: string; content: string }>) => {
    const { createUnit } = await import(
        "../modules/systemd/systemd-unit.service.js"
    );
    const user = c!.get("user");
    await createUnit(body.filename, body.content, user);
    return { ok: true, filename: body.filename };
};

export const Component = () => {
    const navigate = useNavigate();
    const name = useSignal("");
    const type = useSignal("service");
    const content = useSignal(TEMPLATES.service!);

    const handleTypeChange = (e: Event) => {
        const newType = (e.target as HTMLSelectElement).value;
        type.value = newType;
        content.value = TEMPLATES[newType] ?? "";
    };

    const handleCreate = async () => {
        const filename = `${name.value}.${type.value}`;
        try {
            const result = await action_create({ body: { filename, content: content.value } });
            if (result && typeof result === "object" && "error" in result) {
                toast(String((result as { error: string }).error), "error");
                return;
            }
            toast("Unit created");
            navigate(`/systemd/${filename}`);
        } catch {
            toast("Failed to create unit", "error");
        }
    };

    return (
        <div class={css.page}>
                <Link to={SystemdList} class={css.backLink}>
                    Back to Systemd
                </Link>

                <div class={css.header}>
                    <h1 class={css.title}>New Unit</h1>
                </div>

                <div class={css.form}>
                    <div class={css.fieldGroup}>
                        <div class={css.field} style={{ flex: 1 }}>
                            <label class={css.label}>Name</label>
                            <input
                                class={css.input}
                                type="text"
                                placeholder="my-backup"
                                value={name.value}
                                onInput={(e) => {
                                    name.value = (
                                        e.target as HTMLInputElement
                                    ).value;
                                }}
                            />
                        </div>
                        <div class={css.field}>
                            <label class={css.label}>Type</label>
                            <select
                                class={css.select}
                                value={type.value}
                                onChange={handleTypeChange}
                            >
                                <option value="service">.service</option>
                                <option value="timer">.timer</option>
                            </select>
                        </div>
                    </div>

                    <QuadletEditor
                        content={content}
                        sectionsConfig={systemdConfig}
                        fetchResources={false}
                    />

                    <ActionButton
                        label="Create Unit"
                        variant="primary"
                        onClick={handleCreate}
                    />
                </div>
        </div>
    );
};
