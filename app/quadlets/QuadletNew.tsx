import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader, useNavigate } from "velojs/hooks";
import { useSignal } from "@preact/signals";
import type { Scope } from "../modules/auth/auth.types.js";
import { QuadletEditor } from "../components/QuadletEditor.js";
import { ActionButton } from "../components/ActionButton.js";
import { toast } from "../components/toast.js";
import * as QuadletList from "./QuadletList.js";
import * as QuadletEdit from "./QuadletEdit.js";
import * as css from "./QuadletNew.css.js";

const TEMPLATES: Record<string, string> = {
    container: `[Unit]
Description=

[Container]
Image=
PublishPort=

[Install]
WantedBy=multi-user.target
`,
    network: `[Network]
Subnet=
Gateway=
`,
    volume: `[Volume]
`,
};

interface QuadletNewData {
    hasSudo: boolean;
}

export const loader = async ({ c }: LoaderArgs) => {
    const user = c.get("user");
    return { hasSudo: user?.hasSudo ?? false } satisfies QuadletNewData;
};

export const action_create = async ({
    body, c,
}: ActionArgs<{ filename: string; content: string; scope: Scope }>) => {
    const { createQuadlet } = await import(
        "../modules/quadlet/quadlet.service.js"
    );
    const user = c!.get("user");
    await createQuadlet(body.filename, body.content, body.scope, user);
    return { ok: true, filename: body.filename };
};

export const Component = () => {
    const navigate = useNavigate();
    const { data } = useLoader<QuadletNewData>();
    const name = useSignal("");
    const type = useSignal("container");
    const scope = useSignal<Scope>("user");
    const content = useSignal(TEMPLATES.container!);

    const handleTypeChange = (e: Event) => {
        const newType = (e.target as HTMLSelectElement).value;
        type.value = newType;
        content.value = TEMPLATES[newType] ?? "";
    };

    const handleCreate = async () => {
        const filename = `${name.value}.${type.value}`;
        try {
            await action_create({ body: { filename, content: content.value, scope: scope.value } });
            toast("Quadlet created");
            navigate(`/quadlets/${filename}?scope=${scope.value}`);
        } catch {
            toast("Failed to create quadlet", "error");
        }
    };

    return (
        <div class={css.page}>
                <Link to={QuadletList} class={css.backLink}>
                    Back to Quadlets
                </Link>

                <div class={css.header}>
                    <h1 class={css.title}>New Quadlet</h1>
                </div>

                <div class={css.form}>
                    <div class={css.fieldGroup}>
                        <div class={css.field} style={{ flex: 1 }}>
                            <label class={css.label}>Name</label>
                            <input
                                class={css.input}
                                type="text"
                                placeholder="my-service"
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
                                <option value="container">
                                    .container
                                </option>
                                <option value="network">.network</option>
                                <option value="volume">.volume</option>
                            </select>
                        </div>
                        <div class={css.field}>
                            <label class={css.label}>Scope</label>
                            <select
                                class={css.select}
                                value={scope.value}
                                onChange={(e) => {
                                    scope.value = (e.target as HTMLSelectElement).value as Scope;
                                }}
                            >
                                <option value="user">User</option>
                                {data.value?.hasSudo && (
                                    <option value="system">System</option>
                                )}
                            </select>
                        </div>
                    </div>

                    <QuadletEditor content={content} />

                    <ActionButton
                        label="Create Quadlet"
                        variant="primary"
                        onClick={handleCreate}
                    />
                </div>
        </div>
    );
};
