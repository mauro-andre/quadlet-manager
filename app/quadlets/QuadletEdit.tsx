import type { LoaderArgs, ActionArgs } from "velojs";
import { Link } from "velojs";
import { useLoader, useParams } from "velojs/hooks";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import type { QuadletFile } from "../modules/quadlet/quadlet.types.js";
import { AppShell } from "../components/AppShell.js";
import { CodeEditor } from "../components/CodeEditor.js";
import { ActionButton } from "../components/ActionButton.js";
import * as QuadletList from "./QuadletList.js";
import * as css from "./QuadletEdit.css.js";

interface QuadletEditData {
    quadlet: QuadletFile;
}

export const loader = async ({ params }: LoaderArgs) => {
    const { getQuadlet } = await import(
        "../modules/quadlet/quadlet.service.js"
    );
    return { quadlet: await getQuadlet(params.name!) } satisfies QuadletEditData;
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

    const { quadlet } = data.value;

    return (
        <AppShell>
            <div class={css.page}>
                <Link to={QuadletList} class={css.backLink}>
                    Back to Quadlets
                </Link>

                <div class={css.header}>
                    <h1 class={css.title}>{quadlet.filename}</h1>
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

                <CodeEditor value={content} />
            </div>
        </AppShell>
    );
};
