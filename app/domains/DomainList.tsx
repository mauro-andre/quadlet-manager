import type { LoaderArgs, ActionArgs } from "velojs";
import { useLoader } from "velojs/hooks";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import type { ProxyConfig, DomainMapping, SslMode, ContainerOption, TargetType } from "../modules/proxy/proxy.types.js";
import { ActionButton } from "../components/ActionButton.js";
import { toast } from "../components/toast.js";
import { confirm } from "../components/confirm.js";
import * as css from "./DomainList.css.js";

interface DomainListData {
    config: ProxyConfig;
    domains: DomainMapping[];
    serviceStatus: string;
}

// ── Loader ────────────────────────────────────────────────────

export const loader = async ({ c }: LoaderArgs) => {
    const { getProxyStatus } = await import(
        "../modules/proxy/proxy.service.js"
    );
    const status = await getProxyStatus();
    return {
        config: status.config,
        domains: status.domains,
        serviceStatus: status.serviceStatus,
    } satisfies DomainListData;
};

// ── Actions ───────────────────────────────────────────────────

export const action_enable = async ({
    body, c,
}: ActionArgs<{ sslMode: SslMode; cert?: string; key?: string }>) => {
    const { enableProxy } = await import(
        "../modules/proxy/proxy.service.js"
    );
    const user = c!.get("user");
    await enableProxy(body.sslMode, user, body.cert, body.key);
    return { ok: true };
};

export const action_disable = async ({ c }: ActionArgs<Record<string, never>>) => {
    const { disableProxy } = await import(
        "../modules/proxy/proxy.service.js"
    );
    const user = c!.get("user");
    await disableProxy(user);
    return { ok: true };
};

export const action_add = async ({
    body,
}: ActionArgs<{
    domain: string;
    containerName: string;
    containerPort: number;
    targetType: TargetType;
    tls: boolean;
    backendHttps: boolean;
}>) => {
    const { proxyStore } = await import("../modules/proxy/proxy.store.js");
    const { regenerateCaddyfile } = await import(
        "../modules/proxy/proxy.service.js"
    );
    await proxyStore.addDomain(body.domain, body.containerName, body.containerPort, body.targetType, body.tls, body.backendHttps);
    await regenerateCaddyfile();
    return { ok: true };
};

export const action_update = async ({
    body,
}: ActionArgs<{
    id: string;
    domain: string;
    containerName: string;
    containerPort: number;
    targetType: TargetType;
    tls: boolean;
    backendHttps: boolean;
}>) => {
    const { proxyStore } = await import("../modules/proxy/proxy.store.js");
    const { regenerateCaddyfile } = await import(
        "../modules/proxy/proxy.service.js"
    );
    await proxyStore.updateDomain(body.id, body.domain, body.containerName, body.containerPort, body.targetType, body.tls, body.backendHttps);
    await regenerateCaddyfile();
    return { ok: true };
};

export const action_delete = async ({
    body,
}: ActionArgs<{ id: string }>) => {
    const { proxyStore } = await import("../modules/proxy/proxy.store.js");
    const { regenerateCaddyfile } = await import(
        "../modules/proxy/proxy.service.js"
    );
    await proxyStore.deleteDomain(body.id);
    await regenerateCaddyfile();
    return { ok: true };
};

export const action_toggle = async ({
    body,
}: ActionArgs<{ id: string; enabled: boolean }>) => {
    const { proxyStore } = await import("../modules/proxy/proxy.store.js");
    const { regenerateCaddyfile } = await import(
        "../modules/proxy/proxy.service.js"
    );
    await proxyStore.toggleDomain(body.id, body.enabled);
    await regenerateCaddyfile();
    return { ok: true };
};

// ── Component ─────────────────────────────────────────────────

export const Component = () => {
    const { data, loading, refetch } = useLoader<DomainListData>();

    // UI state
    const uiState = useSignal<"disabled" | "setup" | "active">("disabled");
    const editingDomain = useSignal<DomainMapping | null>(null);
    const showAddForm = useSignal(false);

    // Setup form state
    const sslMode = useSignal<SslMode>("letsencrypt");
    const certContent = useSignal("");
    const keyContent = useSignal("");
    const sysctlCheck = useSignal<{ canBindPort80: boolean; currentValue: number } | null>(null);
    const setupLoading = useSignal(false);

    // Add/edit form state
    const formDomain = useSignal("");
    const formContainer = useSignal("");
    const formPort = useSignal("");
    const formPortManual = useSignal(false);
    const formTargetType = useSignal<TargetType>("container");
    const formTls = useSignal(true);
    const formBackendHttps = useSignal(false);
    const containers = useSignal<ContainerOption[]>([]);

    // Derive UI state from loaded data
    useEffect(() => {
        if (!data.value) return;
        uiState.value = data.value.config.enabled ? "active" : "disabled";
    }, [data.value?.config.enabled]);

    const run = (action: Promise<unknown>, msg: string) =>
        action
            .then(() => { toast(msg); refetch(); })
            .catch((err) => toast(err?.message ?? "Action failed", "error"));

    // Fetch containers for add/edit form
    const fetchContainers = async () => {
        try {
            const res = await fetch("/api/proxy/containers");
            const data = await res.json();
            containers.value = data;
        } catch {
            containers.value = [];
        }
    };

    const checkSysctl = async () => {
        try {
            const res = await fetch("/api/proxy/sysctl");
            sysctlCheck.value = await res.json();
        } catch {
            sysctlCheck.value = { canBindPort80: false, currentValue: 1024 };
        }
    };

    const handleStartSetup = () => {
        uiState.value = "setup";
        checkSysctl();
    };

    const handleCancelSetup = () => {
        uiState.value = "disabled";
        sslMode.value = "letsencrypt";
        certContent.value = "";
        keyContent.value = "";
    };

    const handleEnable = async () => {
        setupLoading.value = true;
        try {
            const result = await action_enable({
                body: {
                    sslMode: sslMode.value,
                    cert: sslMode.value === "custom" ? certContent.value : undefined,
                    key: sslMode.value === "custom" ? keyContent.value : undefined,
                },
            });
            if (result && typeof result === "object" && "error" in result) {
                toast(String((result as { error: string }).error), "error");
            } else {
                toast("Domain management enabled");
                refetch();
            }
        } catch (err) {
            toast(err instanceof Error ? err.message : "Failed to enable", "error");
        } finally {
            setupLoading.value = false;
        }
    };

    const handleDisable = async () => {
        if (!await confirm("Disable domain management? Caddy will be stopped and quadlets removed. Your domain configuration will be preserved.", {
            variant: "danger",
            confirmLabel: "Disable",
        })) return;

        run(
            action_disable({ body: {} }),
            "Domain management disabled"
        );
    };

    const openAddForm = () => {
        editingDomain.value = null;
        formDomain.value = "";
        formContainer.value = "";
        formPort.value = "";
        formPortManual.value = false;
        formTargetType.value = "container";
        formTls.value = true;
        formBackendHttps.value = false;
        showAddForm.value = true;
        fetchContainers();
    };

    const openEditForm = (d: DomainMapping) => {
        editingDomain.value = d;
        formDomain.value = d.domain;
        formContainer.value = d.containerName;
        formPort.value = String(d.containerPort);
        formPortManual.value = d.targetType === "host";
        formTargetType.value = d.targetType;
        formTls.value = d.tls;
        formBackendHttps.value = d.backendHttps;
        showAddForm.value = true;
        fetchContainers();
    };

    const closeForm = () => {
        showAddForm.value = false;
        editingDomain.value = null;
    };

    const handleSaveDomain = () => {
        const domain = formDomain.value.trim();
        const containerName = formTargetType.value === "container" ? formContainer.value.trim() : "";
        const containerPort = parseInt(formPort.value, 10);
        const targetType = formTargetType.value;
        const tls = formTls.value;
        const backendHttps = formBackendHttps.value;

        if (!domain || !containerPort) {
            toast("Domain and port are required", "error");
            return;
        }

        if (targetType === "container" && !containerName) {
            toast("Container is required", "error");
            return;
        }

        if (editingDomain.value) {
            run(
                action_update({
                    body: {
                        id: editingDomain.value.id,
                        domain,
                        containerName,
                        containerPort,
                        targetType,
                        tls,
                        backendHttps,
                    },
                }),
                `Domain ${domain} updated`
            );
        } else {
            run(
                action_add({ body: { domain, containerName, containerPort, targetType, tls, backendHttps } }),
                `Domain ${domain} added`
            );
        }
        closeForm();
    };

    if (loading.value) return <div>Loading...</div>;

    const config = data.value?.config;
    const domains = data.value?.domains ?? [];
    const serviceStatus = data.value?.serviceStatus ?? "unknown";

    // ── State 1: Disabled ─────────────────────────────────────

    if (uiState.value === "disabled") {
        return (
            <div class={css.page}>
                <h1 class={css.title}>Domains</h1>
                <div class={css.enableCard}>
                    <div class={css.enableTitle}>Domain Management</div>
                    <div class={css.enableDescription}>
                        Manage reverse proxy domains for your containers with automatic SSL.
                        Caddy will be deployed as a container via Quadlets, providing HTTPS
                        with Let's Encrypt or custom certificates.
                    </div>
                    <button class={css.enableButton} onClick={handleStartSetup}>
                        Enable Domain Management
                    </button>
                </div>
            </div>
        );
    }

    // ── State 2: Setup ────────────────────────────────────────

    if (uiState.value === "setup") {
        const sysctl = sysctlCheck.value;

        return (
            <div class={css.page}>
                <h1 class={css.title}>Domains</h1>
                <div class={css.setupCard}>
                    <div class={css.setupTitle}>Setup Domain Management</div>

                    {sysctl && !sysctl.canBindPort80 && (
                        <div class={css.warningBox}>
                            <div class={css.warningTitle}>
                                Port 80 not available for rootless containers
                            </div>
                            <div>
                                The current unprivileged port start is{" "}
                                <strong>{sysctl.currentValue}</strong>. Caddy needs
                                to bind to port 80 and 443. Run the following command
                                to allow it:
                            </div>
                            <code class={css.warningCode}>
                                sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80
                            </code>
                            <div style={{ marginTop: "4px", fontSize: "11px", color: "inherit", opacity: 0.8 }}>
                                To persist across reboots, add{" "}
                                <code>net.ipv4.ip_unprivileged_port_start=80</code>{" "}
                                to <code>/etc/sysctl.conf</code>
                            </div>
                            <button class={css.checkAgainButton} onClick={checkSysctl}>
                                Check again
                            </button>
                        </div>
                    )}

                    <div class={css.formGroup}>
                        <div class={css.label}>SSL Mode</div>
                        <div class={css.radioGroup}>
                            <label
                                class={`${css.radioOption} ${sslMode.value === "letsencrypt" ? css.radioOptionSelected : ""}`}
                                onClick={() => { sslMode.value = "letsencrypt"; }}
                            >
                                <input
                                    type="radio"
                                    name="sslMode"
                                    checked={sslMode.value === "letsencrypt"}
                                    onChange={() => { sslMode.value = "letsencrypt"; }}
                                />
                                <div>
                                    <div class={css.radioLabel}>Let's Encrypt</div>
                                    <div class={css.radioDescription}>
                                        Automatic SSL certificates via ACME. Requires ports 80/443
                                        accessible from the internet.
                                    </div>
                                </div>
                            </label>
                            <label
                                class={`${css.radioOption} ${sslMode.value === "custom" ? css.radioOptionSelected : ""}`}
                                onClick={() => { sslMode.value = "custom"; }}
                            >
                                <input
                                    type="radio"
                                    name="sslMode"
                                    checked={sslMode.value === "custom"}
                                    onChange={() => { sslMode.value = "custom"; }}
                                />
                                <div>
                                    <div class={css.radioLabel}>Custom Certificate</div>
                                    <div class={css.radioDescription}>
                                        Use your own certificate and key (e.g. Cloudflare Origin,
                                        self-signed).
                                    </div>
                                </div>
                            </label>
                            <label
                                class={`${css.radioOption} ${sslMode.value === "none" ? css.radioOptionSelected : ""}`}
                                onClick={() => { sslMode.value = "none"; }}
                            >
                                <input
                                    type="radio"
                                    name="sslMode"
                                    checked={sslMode.value === "none"}
                                    onChange={() => { sslMode.value = "none"; }}
                                />
                                <div>
                                    <div class={css.radioLabel}>None (HTTP only)</div>
                                    <div class={css.radioDescription}>
                                        No SSL. Useful for development or when SSL is terminated
                                        externally.
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {sslMode.value === "custom" && (
                        <div class={css.formGroup}>
                            <div class={css.label}>Certificate (PEM)</div>
                            <textarea
                                class={css.textarea}
                                value={certContent.value}
                                onInput={(e) => {
                                    certContent.value = (e.target as HTMLTextAreaElement).value;
                                }}
                                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                            />
                            <div class={css.label} style={{ marginTop: "12px" }}>
                                Private Key (PEM)
                            </div>
                            <textarea
                                class={css.textarea}
                                value={keyContent.value}
                                onInput={(e) => {
                                    keyContent.value = (e.target as HTMLTextAreaElement).value;
                                }}
                                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                            />
                        </div>
                    )}

                    <div class={css.formActions}>
                        <button class={css.cancelButton} onClick={handleCancelSetup}>
                            Cancel
                        </button>
                        <button
                            class={css.submitButton}
                            onClick={handleEnable}
                            disabled={
                                setupLoading.value ||
                                (sslMode.value === "custom" &&
                                    (!certContent.value.trim() || !keyContent.value.trim()))
                            }
                        >
                            {setupLoading.value ? "Enabling..." : "Enable"}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── State 3: Active ───────────────────────────────────────

    const isServiceActive = serviceStatus === "active";
    const selectedContainer = containers.value.find((c) => c.name === formContainer.value);
    const selectedPorts = selectedContainer?.ports ?? [];

    return (
        <div class={css.page}>
            <div class={css.header}>
                <h1 class={css.title}>Domains</h1>
                <div class={css.headerRight}>
                    <span
                        class={`${css.statusBadge} ${isServiceActive ? css.statusActive : css.statusInactive}`}
                    >
                        <span
                            class={`${css.statusDot} ${isServiceActive ? css.statusDotActive : css.statusDotInactive}`}
                        />
                        Caddy {serviceStatus}
                    </span>
                    <button class={css.addButton} onClick={openAddForm}>
                        Add Domain
                    </button>
                </div>
            </div>

            {/* Inline add/edit form */}
            {showAddForm.value && (
                <div class={css.inlineForm}>
                    <div class={css.inlineFormTitle}>
                        {editingDomain.value ? "Edit Domain" : "Add Domain"}
                    </div>
                    <div class={css.inlineFormRow}>
                        <div class={css.inlineFormField}>
                            <div class={css.inlineFormLabel}>Domain</div>
                            <input
                                type="text"
                                class={css.input}
                                value={formDomain.value}
                                onInput={(e) => {
                                    formDomain.value = (e.target as HTMLInputElement).value;
                                }}
                                placeholder="app.example.com"
                            />
                        </div>
                        <div class={css.inlineFormField}>
                            <div class={css.inlineFormLabel}>Target</div>
                            <select
                                class={css.select}
                                value={formTargetType.value}
                                onChange={(e) => {
                                    const val = (e.target as HTMLSelectElement).value as TargetType;
                                    formTargetType.value = val;
                                    if (val === "host") {
                                        formContainer.value = "";
                                        formPortManual.value = true;
                                    } else {
                                        formPortManual.value = false;
                                        formBackendHttps.value = false;
                                    }
                                }}
                            >
                                <option value="container">Container</option>
                                <option value="host">Host Service</option>
                            </select>
                        </div>
                        {formTargetType.value === "container" && (
                            <div class={css.inlineFormField}>
                                <div class={css.inlineFormLabel}>Container</div>
                                <select
                                    class={css.select}
                                    value={formContainer.value}
                                    onChange={(e) => {
                                        formContainer.value = (e.target as HTMLSelectElement).value;
                                        const ct = containers.value.find(
                                            (c) => c.name === (e.target as HTMLSelectElement).value
                                        );
                                        if (ct?.ports.length) {
                                            formPort.value = String(ct.ports[0]);
                                            formPortManual.value = false;
                                        } else {
                                            formPort.value = "";
                                        }
                                    }}
                                >
                                    <option value="">Select container...</option>
                                    {containers.value.map((ct) => (
                                        <option key={ct.id} value={ct.name}>
                                            {ct.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div class={css.inlineFormField}>
                            <div class={css.inlineFormLabel}>Port</div>
                            {formTargetType.value === "container" && !formPortManual.value && selectedPorts.length > 0 ? (
                                <select
                                    class={css.select}
                                    value={formPort.value}
                                    onChange={(e) => {
                                        const val = (e.target as HTMLSelectElement).value;
                                        if (val === "__manual") {
                                            formPortManual.value = true;
                                            formPort.value = "";
                                        } else {
                                            formPort.value = val;
                                        }
                                    }}
                                >
                                    {selectedPorts.map((p) => (
                                        <option key={p} value={String(p)}>
                                            {p}
                                        </option>
                                    ))}
                                    <option value="__manual">Custom...</option>
                                </select>
                            ) : (
                                <input
                                    type="number"
                                    class={css.input}
                                    value={formPort.value}
                                    onInput={(e) => {
                                        formPort.value = (e.target as HTMLInputElement).value;
                                    }}
                                    placeholder={formTargetType.value === "host" ? "3000" : "80"}
                                    min="1"
                                    max="65535"
                                />
                            )}
                        </div>
                    </div>
                    <div class={css.inlineFormOptions}>
                        {config?.sslMode !== "none" && (
                            <label class={css.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={formTls.value}
                                    onChange={(e) => {
                                        formTls.value = (e.target as HTMLInputElement).checked;
                                    }}
                                />
                                TLS
                            </label>
                        )}
                        {formTargetType.value === "host" && (
                            <label class={css.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={formBackendHttps.value}
                                    onChange={(e) => {
                                        formBackendHttps.value = (e.target as HTMLInputElement).checked;
                                    }}
                                />
                                Backend HTTPS
                            </label>
                        )}
                    </div>
                    <div class={css.inlineFormActions}>
                        <button class={css.cancelButton} onClick={closeForm}>
                            Cancel
                        </button>
                        <button class={css.submitButton} onClick={handleSaveDomain}>
                            Save
                        </button>
                    </div>
                </div>
            )}

            {/* Domain table */}
            <div class={css.tableWrapper}>
                {domains.length === 0 ? (
                    <div class={css.empty}>
                        No domains configured. Click "Add Domain" to get started.
                    </div>
                ) : (
                    <table class={css.table}>
                        <thead>
                            <tr>
                                <th class={css.th}>Domain</th>
                                <th class={css.th}>Target</th>
                                <th class={css.th}>Port</th>
                                <th class={css.th}>Status</th>
                                <th class={css.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {domains.map((d) => {
                                const ct = d.targetType === "container"
                                    ? containers.value.find((c) => c.name === d.containerName)
                                    : null;
                                const onCaddyNetwork = ct?.networks.includes("caddy") ?? false;
                                const useTls = config?.sslMode !== "none" && d.tls;

                                return (
                                    <tr key={d.id}>
                                        <td class={css.td}>
                                            <span class={css.domainName}>{d.domain}</span>
                                            {config?.sslMode !== "none" && (
                                                useTls
                                                    ? <span class={css.tlsBadge}>TLS</span>
                                                    : <span class={css.httpBadge}>HTTP</span>
                                            )}
                                        </td>
                                        <td class={css.td}>
                                            {d.targetType === "host" ? (
                                                <>
                                                    Host :{d.containerPort}
                                                    {d.backendHttps && (
                                                        <span class={css.httpsIndicator}>(HTTPS)</span>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    {d.containerName}
                                                    {ct && !onCaddyNetwork && (
                                                        <div class={css.networkWarning}>
                                                            Not on caddy network
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                        <td class={css.td}>{d.containerPort}</td>
                                        <td class={css.td}>
                                            {d.enabled ? (
                                                <span
                                                    class={`${css.statusBadge} ${css.statusActive}`}
                                                >
                                                    <span
                                                        class={`${css.statusDot} ${css.statusDotActive}`}
                                                    />
                                                    Enabled
                                                </span>
                                            ) : (
                                                <span class={css.disabledBadge}>
                                                    Disabled
                                                </span>
                                            )}
                                        </td>
                                        <td class={css.td}>
                                            <div class={css.actionsCell}>
                                                <ActionButton
                                                    label="Edit"
                                                    onClick={async () => openEditForm(d)}
                                                />
                                                <ActionButton
                                                    label={d.enabled ? "Disable" : "Enable"}
                                                    onClick={async () => {
                                                        run(
                                                            action_toggle({
                                                                body: {
                                                                    id: d.id,
                                                                    enabled: !d.enabled,
                                                                },
                                                            }),
                                                            `${d.domain} ${d.enabled ? "disabled" : "enabled"}`
                                                        );
                                                    }}
                                                />
                                                <ActionButton
                                                    label="Delete"
                                                    variant="danger"
                                                    onClick={async () => {
                                                        if (await confirm(
                                                            `Delete domain ${d.domain}? This will remove it from the proxy configuration.`,
                                                            { confirmLabel: "Delete" }
                                                        )) {
                                                            run(
                                                                action_delete({
                                                                    body: { id: d.id },
                                                                }),
                                                                `${d.domain} deleted`
                                                            );
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Settings section */}
            <div class={css.settingsSection}>
                <div class={css.settingsTitle}>Settings</div>
                <div class={css.settingsRow}>
                    <span class={css.settingsLabel}>SSL Mode</span>
                    <span class={css.settingsValue}>
                        {config?.sslMode === "letsencrypt" && "Let's Encrypt"}
                        {config?.sslMode === "custom" && "Custom Certificate"}
                        {config?.sslMode === "none" && "None (HTTP only)"}
                    </span>
                </div>
                <div class={css.settingsRow}>
                    <span class={css.settingsLabel}>Caddy Status</span>
                    <span class={css.settingsValue}>{serviceStatus}</span>
                </div>
                <div class={css.settingsRow}>
                    <span class={css.settingsLabel}>Domain Management</span>
                    <button class={css.disableButton} onClick={handleDisable}>
                        Disable
                    </button>
                </div>
            </div>
        </div>
    );
};
