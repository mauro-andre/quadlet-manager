import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useNavigate } from "velojs/hooks";
import { useSignal } from "@preact/signals";
import { QuadletEditor } from "../components/QuadletEditor.js";
import { ActionButton } from "../components/ActionButton.js";
import { toast } from "../components/toast.js";
import * as QuadletList from "./QuadletList.js";
import * as css from "./QuadletNew.css.js";

const TEMPLATES: Record<string, string> = {
    container: `[Unit]
Description=

[Container]
Image=
PublishPort=

[Install]
WantedBy=default.target
`,
    network: `[Network]
Subnet=
Gateway=
`,
    volume: `[Volume]
`,
    pod: `[Pod]
PodName=

[Install]
WantedBy=default.target
`,
};

export const action_create = async ({
    body, c,
}: ActionArgs<{ filename: string; content: string }>) => {
    const { createQuadlet } = await import(
        "../modules/quadlet/quadlet.service.js"
    );
    const user = c!.get("user");
    await createQuadlet(body.filename, body.content, user);
    return { ok: true, filename: body.filename };
};

export const Component = () => {
    const navigate = useNavigate();
    const name = useSignal("");
    const type = useSignal("container");
    const content = useSignal(TEMPLATES.container!);

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
            toast("Quadlet created");
            navigate(`/quadlets/${filename}`);
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
                                <option value="pod">.pod</option>
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
