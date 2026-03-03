import type { LoaderArgs, ActionArgs } from "velojs";
import { useSignal } from "@preact/signals";
import { useLoader } from "velojs/hooks";
import type { Scope } from "../modules/auth/auth.types.js";
import type { RegistryEntry } from "../modules/registry/registry.service.js";
import { ActionButton } from "../components/ActionButton.js";
import { ScopeBadge } from "../components/ScopeBadge.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import * as css from "./RegistryList.css.js";

const KNOWN_REGISTRIES = [
    { label: "Docker Hub", value: "docker.io" },
    { label: "GitHub (ghcr.io)", value: "ghcr.io" },
    { label: "GitLab", value: "registry.gitlab.com" },
    { label: "Quay.io", value: "quay.io" },
    { label: "Red Hat", value: "registry.redhat.io" },
    { label: "Google Artifact Registry", value: "us-docker.pkg.dev" },
    { label: "Amazon ECR Public", value: "public.ecr.aws" },
];

interface RegistryListData {
    registries: RegistryEntry[];
    hasSudo: boolean;
}

export const loader = async ({ c }: LoaderArgs) => {
    const { listRegistries } = await import(
        "../modules/registry/registry.service.js"
    );
    const user = c.get("user");
    const registries = await listRegistries(user);
    return { registries, hasSudo: user.hasSudo } satisfies RegistryListData;
};

export const action_login = async ({
    body, c,
}: ActionArgs<{ registry: string; username: string; password: string; scope: Scope }>) => {
    const { loginRegistry } = await import(
        "../modules/registry/registry.service.js"
    );
    const user = c!.get("user");
    await loginRegistry(body.registry, body.username, body.password, body.scope, user);
    return { ok: true };
};

export const action_logout = async ({
    body, c,
}: ActionArgs<{ registry: string; scope: Scope }>) => {
    const { logoutRegistry } = await import(
        "../modules/registry/registry.service.js"
    );
    const user = c!.get("user");
    await logoutRegistry(body.registry, body.scope, user);
    return { ok: true };
};

export const Component = () => {
    const { data, loading, refetch } = useLoader<RegistryListData>();

    const showForm = useSignal(false);
    const formRegistrySelect = useSignal("");
    const formRegistryCustom = useSignal("");
    const formUsername = useSignal("");
    const formPassword = useSignal("");
    const formScope = useSignal<Scope>("user");
    const submitting = useSignal(false);

    if (loading.value) return <div>Loading...</div>;

    const registries = data.value?.registries ?? [];
    const hasSudo = data.value?.hasSudo ?? false;

    const isCustom = formRegistrySelect.value === "__custom__";
    const registryValue = isCustom ? formRegistryCustom.value.trim() : formRegistrySelect.value;
    const canSubmit = registryValue && formUsername.value.trim() && formPassword.value.trim();

    const resetForm = () => {
        showForm.value = false;
        formRegistrySelect.value = "";
        formRegistryCustom.value = "";
        formUsername.value = "";
        formPassword.value = "";
        formScope.value = "user";
        submitting.value = false;
    };

    const handleLogin = async () => {
        if (!canSubmit) return;
        submitting.value = true;
        try {
            const result = await action_login({
                body: {
                    registry: registryValue,
                    username: formUsername.value.trim(),
                    password: formPassword.value,
                    scope: formScope.value,
                },
            });
            if (result && typeof result === "object" && "error" in result) {
                toast(String((result as { error: string }).error), "error");
                submitting.value = false;
                return;
            }
            toast(`Logged in to ${registryValue}`);
            resetForm();
            refetch();
        } catch {
            toast("Login failed", "error");
            submitting.value = false;
        }
    };

    const handleLogout = async (registry: string, scope: Scope) => {
        if (!await confirm(`Logout from ${registry}?`, { confirmLabel: "Logout" })) return;
        try {
            const result = await action_logout({ body: { registry, scope } });
            if (result && typeof result === "object" && "error" in result) {
                toast(String((result as { error: string }).error), "error");
                return;
            }
            toast(`Logged out from ${registry}`);
            refetch();
        } catch {
            toast("Logout failed", "error");
        }
    };

    return (
        <div class={css.page}>
            <div class={css.header}>
                <h1 class={css.title}>Registries</h1>
                {!showForm.value && (
                    <button
                        class={css.addButton}
                        onClick={() => { showForm.value = true; }}
                    >
                        Add Registry
                    </button>
                )}
            </div>

            {showForm.value && (
                <div class={css.inlineForm}>
                    <div class={css.inlineFormTitle}>Login to Registry</div>
                    <div class={css.inlineFormRow}>
                        <div class={css.inlineFormField}>
                            <label class={css.inlineFormLabel}>Registry</label>
                            <select
                                class={css.select}
                                value={formRegistrySelect.value}
                                onChange={(e) => {
                                    formRegistrySelect.value = (e.target as HTMLSelectElement).value;
                                }}
                            >
                                <option value="">Select registry...</option>
                                {KNOWN_REGISTRIES.map((r) => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                                <option value="__custom__">Custom...</option>
                            </select>
                        </div>

                        {isCustom && (
                            <div class={css.inlineFormField}>
                                <label class={css.inlineFormLabel}>Registry URL</label>
                                <input
                                    type="text"
                                    class={css.input}
                                    value={formRegistryCustom.value}
                                    onInput={(e) => {
                                        formRegistryCustom.value = (e.target as HTMLInputElement).value;
                                    }}
                                    placeholder="registry.example.com"
                                />
                            </div>
                        )}

                        <div class={css.inlineFormField}>
                            <label class={css.inlineFormLabel}>Username</label>
                            <input
                                type="text"
                                class={css.input}
                                value={formUsername.value}
                                onInput={(e) => {
                                    formUsername.value = (e.target as HTMLInputElement).value;
                                }}
                                placeholder="username"
                            />
                        </div>

                        <div class={css.inlineFormField}>
                            <label class={css.inlineFormLabel}>Password / Token</label>
                            <input
                                type="password"
                                class={css.input}
                                value={formPassword.value}
                                onInput={(e) => {
                                    formPassword.value = (e.target as HTMLInputElement).value;
                                }}
                                placeholder="Personal Access Token"
                            />
                        </div>

                        {hasSudo && (
                            <div class={css.inlineFormField}>
                                <label class={css.inlineFormLabel}>Scope</label>
                                <select
                                    class={css.select}
                                    value={formScope.value}
                                    onChange={(e) => {
                                        formScope.value = (e.target as HTMLSelectElement).value as Scope;
                                    }}
                                >
                                    <option value="user">User</option>
                                    <option value="system">System</option>
                                </select>
                            </div>
                        )}
                    </div>

                    <div class={css.inlineFormActions}>
                        <button class={css.cancelButton} onClick={resetForm}>
                            Cancel
                        </button>
                        <button
                            class={css.submitButton}
                            disabled={!canSubmit || submitting.value}
                            onClick={handleLogin}
                        >
                            {submitting.value ? "Logging in..." : "Login"}
                        </button>
                    </div>
                </div>
            )}

            <div class={css.tableWrapper}>
                {registries.length === 0 ? (
                    <div class={css.empty}>
                        No registry credentials configured. Click "Add Registry" to authenticate with a container registry.
                    </div>
                ) : (
                    <table class={css.table}>
                        <thead>
                            <tr>
                                <th class={css.th}>Registry</th>
                                <th class={css.th}>Username</th>
                                <th class={css.th}>Scope</th>
                                <th class={css.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {registries.map((reg) => (
                                <tr key={`${reg.scope}-${reg.registry}`}>
                                    <td class={css.td}>
                                        <span class={css.registryName}>{reg.registry}</span>
                                    </td>
                                    <td class={css.td}>{reg.username}</td>
                                    <td class={css.td}>
                                        <ScopeBadge scope={reg.scope} />
                                    </td>
                                    <td class={css.td}>
                                        <div class={css.actionsCell}>
                                            <ActionButton
                                                label="Logout"
                                                variant="danger"
                                                onClick={() => handleLogout(reg.registry, reg.scope)}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
