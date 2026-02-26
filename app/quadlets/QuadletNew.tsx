import type { ActionArgs } from "velojs";
import { Link } from "velojs";
import { useNavigate } from "velojs/hooks";
import { useSignal } from "@preact/signals";
import { CodeEditor } from "../components/CodeEditor.js";
import { ActionButton } from "../components/ActionButton.js";
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

export const action_create = async ({
    body,
}: ActionArgs<{ filename: string; content: string }>) => {
    const { createQuadlet } = await import(
        "../modules/quadlet/quadlet.service.js"
    );
    await createQuadlet(body.filename, body.content);
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
        await action_create({ body: { filename, content: content.value } });
        navigate(`/quadlets/${filename}`);
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
                    </div>

                    <CodeEditor value={content} />

                    <ActionButton
                        label="Create Quadlet"
                        variant="primary"
                        onClick={handleCreate}
                    />
                </div>
        </div>
    );
};
