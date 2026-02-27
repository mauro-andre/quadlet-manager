import type { Signal } from "@preact/signals";
import { useSignal } from "@preact/signals";
import { useCallback, useRef, useEffect } from "preact/hooks";
import { CodeEditor } from "./CodeEditor.js";
import {
    parseQuadlet,
    serializeQuadlet,
    type QuadletSection,
    type QuadletEntry,
} from "../modules/quadlet/quadlet.parser.js";
import {
    SECTIONS,
    getSectionSpec,
    getDirectiveSpec,
    type DirectiveSpec,
} from "../modules/quadlet/quadlet.directives.js";
import * as css from "./QuadletEditor.css.js";

interface PodmanResources {
    images: string[];
    volumes: string[];
    networks: string[];
}

interface QuadletEditorProps {
    content: Signal<string>;
}

export function QuadletEditor({ content }: QuadletEditorProps) {
    const mode = useSignal<"form" | "code">("form");
    const sections = useSignal<QuadletSection[]>(parseQuadlet(content.value));
    const revision = useSignal(0);
    const resources = useSignal<PodmanResources>({ images: [], volumes: [], networks: [] });

    // Fetch available images, volumes and networks for form dropdowns
    useEffect(() => {
        if (typeof window === "undefined") return;
        Promise.all([
            fetch("/api/podman/images").then((r) => r.json()).catch(() => []),
            fetch("/api/podman/volumes").then((r) => r.json()).catch(() => []),
            fetch("/api/podman/networks").then((r) => r.json()).catch(() => []),
        ]).then(([images, volumes, networks]) => {
            resources.value = { images, volumes, networks };
        });
    }, []);

    // Sync form → content whenever sections change
    const syncToContent = useCallback(() => {
        content.value = serializeQuadlet(sections.value);
    }, [content, sections]);

    // When content changes externally (template switch, loader), re-parse
    useEffect(() => {
        const parsed = parseQuadlet(content.value);
        const currentSerialized = serializeQuadlet(sections.value);
        if (content.value.trim() !== currentSerialized.trim()) {
            sections.value = parsed;
            revision.value++;
        }
    }, [content.value]);

    const switchToForm = useCallback(() => {
        sections.value = parseQuadlet(content.value);
        revision.value++;
        mode.value = "form";
    }, [content, sections, mode, revision]);

    const switchToCode = useCallback(() => {
        content.value = serializeQuadlet(sections.value);
        mode.value = "code";
    }, [content, sections, mode]);

    // Section operations
    const addSection = useCallback((name: string) => {
        sections.value = [...sections.value, { name, entries: [] }];
        syncToContent();
    }, [sections, syncToContent]);

    const removeSection = useCallback((idx: number) => {
        sections.value = sections.value.filter((_, i) => i !== idx);
        syncToContent();
    }, [sections, syncToContent]);

    // Entry operations
    const addEntry = useCallback((sectionIdx: number, key: string, value: string) => {
        const updated = sections.value.map((s, i) => {
            if (i !== sectionIdx) return s;
            // Insert after the last entry with the same key (groups repeatables together)
            let insertIdx = s.entries.length;
            if (key) {
                const lastIdx = s.entries.findLastIndex((e) => e.key === key);
                if (lastIdx >= 0) insertIdx = lastIdx + 1;
            }
            const entries = [...s.entries];
            entries.splice(insertIdx, 0, { key, value });
            return { ...s, entries };
        });
        sections.value = updated;
        syncToContent();
    }, [sections, syncToContent]);

    const updateEntry = useCallback((sectionIdx: number, entryIdx: number, entry: QuadletEntry) => {
        const updated = sections.value.map((s, si) => {
            if (si !== sectionIdx) return s;
            return {
                ...s,
                entries: s.entries.map((e, ei) => (ei === entryIdx ? entry : e)),
            };
        });
        sections.value = updated;
        syncToContent();
    }, [sections, syncToContent]);

    const removeEntry = useCallback((sectionIdx: number, entryIdx: number) => {
        const updated = sections.value.map((s, si) => {
            if (si !== sectionIdx) return s;
            return { ...s, entries: s.entries.filter((_, ei) => ei !== entryIdx) };
        });
        sections.value = updated;
        syncToContent();
    }, [sections, syncToContent]);

    return (
        <div>
            <div class={css.toggleBar}>
                <button
                    class={`${css.toggleBtn} ${mode.value === "form" ? css.toggleBtnActive : ""}`}
                    onClick={switchToForm}
                >
                    Form
                </button>
                <button
                    class={`${css.toggleBtn} ${mode.value === "code" ? css.toggleBtnActive : ""}`}
                    onClick={switchToCode}
                >
                    Code
                </button>
            </div>

            {mode.value === "code" ? (
                <div style={{ marginTop: "12px" }}>
                    <CodeEditor value={content} />
                </div>
            ) : (
                <div class={css.formContainer} style={{ marginTop: "12px" }}>
                    {sections.value.map((section, sIdx) => (
                        <SectionCard
                            key={`${sIdx}-${section.name}-${revision.value}`}
                            section={section}
                            sectionIdx={sIdx}
                            resources={resources.value}
                            onAddEntry={addEntry}
                            onUpdateEntry={updateEntry}
                            onRemoveEntry={removeEntry}
                            onRemoveSection={removeSection}
                        />
                    ))}
                    <AddSectionButton
                        existingSections={sections.value.map((s) => s.name)}
                        onAdd={addSection}
                    />
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// SectionCard
// ---------------------------------------------------------------------------

interface SectionCardProps {
    section: QuadletSection;
    sectionIdx: number;
    resources: PodmanResources;
    onAddEntry: (sectionIdx: number, key: string, value: string) => void;
    onUpdateEntry: (sectionIdx: number, entryIdx: number, entry: QuadletEntry) => void;
    onRemoveEntry: (sectionIdx: number, entryIdx: number) => void;
    onRemoveSection: (idx: number) => void;
}

function SectionCard({
    section,
    sectionIdx,
    resources,
    onAddEntry,
    onUpdateEntry,
    onRemoveEntry,
    onRemoveSection,
}: SectionCardProps) {
    const spec = getSectionSpec(section.name);

    return (
        <div class={css.sectionCard}>
            <div class={css.sectionHeader}>
                <div>
                    <span class={css.sectionName}>[{section.name}]</span>
                    {spec && <span class={css.sectionDesc}>{spec.description}</span>}
                </div>
                <button
                    class={css.sectionRemoveBtn}
                    onClick={() => onRemoveSection(sectionIdx)}
                    title="Remove section"
                >
                    Remove
                </button>
            </div>
            <div class={css.entryList}>
                {section.entries.map((entry, eIdx) => (
                    <EntryRow
                        key={`${eIdx}-${entry.key}`}
                        sectionName={section.name}
                        entry={entry}
                        sectionIdx={sectionIdx}
                        entryIdx={eIdx}
                        resources={resources}
                        onUpdate={onUpdateEntry}
                        onRemove={onRemoveEntry}
                    />
                ))}
            </div>
            <div class={css.addRow}>
                <AddDirectiveButton
                    sectionName={section.name}
                    existingEntries={section.entries}
                    onAdd={(key) => onAddEntry(sectionIdx, key, "")}
                />
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// EntryRow
// ---------------------------------------------------------------------------

interface EntryRowProps {
    sectionName: string;
    entry: QuadletEntry;
    sectionIdx: number;
    entryIdx: number;
    resources: PodmanResources;
    onUpdate: (sectionIdx: number, entryIdx: number, entry: QuadletEntry) => void;
    onRemove: (sectionIdx: number, entryIdx: number) => void;
}

function EntryRow({ sectionName, entry, sectionIdx, entryIdx, resources, onUpdate, onRemove }: EntryRowProps) {
    const spec = getDirectiveSpec(sectionName, entry.key);
    const isMapped = !!spec;
    const customValue = useSignal(false);

    const updateValue = (value: string) => {
        onUpdate(sectionIdx, entryIdx, { key: entry.key, value });
    };

    // --- Pair field ---
    if (spec?.fieldType === "pair") {
        const sep = spec.separator!;
        const sepIdx = entry.value.indexOf(sep);
        const left = sepIdx >= 0 ? entry.value.slice(0, sepIdx) : entry.value;
        const right = sepIdx >= 0 ? entry.value.slice(sepIdx + 1) : "";

        const updatePair = (newLeft: string, newRight: string) => {
            updateValue(newRight ? `${newLeft}${sep}${newRight}` : newLeft);
        };

        // Volume source: dropdown with existing volumes + custom path
        const isVolumeSource = entry.key === "Volume" && sectionName === "Container";
        const volumeOptions = isVolumeSource ? resources.volumes : [];
        const leftIsVolume = isVolumeSource && volumeOptions.includes(left);
        const showLeftCustom = customValue.value;

        return (
            <div class={css.entryRow}>
                <span class={css.entryKeyLabel}>{entry.key}</span>
                <span class={css.entryDesc}>{spec.description}</span>
                <div class={css.pairFieldGroup}>
                    <div class={css.pairField}>
                        <span class={css.pairLabel}>{spec.leftLabel}</span>
                        <div class={css.inputWithAction}>
                            {isVolumeSource && !showLeftCustom ? (
                                <select
                                    class={css.entrySelect}
                                    value={leftIsVolume || !left ? left : "__custom__"}
                                    onChange={(e) => {
                                        const val = (e.target as HTMLSelectElement).value;
                                        if (val === "__custom__") {
                                            customValue.value = true;
                                            updatePair("", right);
                                        } else {
                                            updatePair(val, right);
                                        }
                                    }}
                                >
                                    <option value="">— Select volume —</option>
                                    {volumeOptions.map((v) => (
                                        <option key={v} value={v}>{v}</option>
                                    ))}
                                    <option value="__custom__">Custom path...</option>
                                </select>
                            ) : (
                                <input
                                    class={css.entryInput}
                                    value={left}
                                    onInput={(e) => updatePair((e.target as HTMLInputElement).value, right)}
                                    placeholder={isVolumeSource ? "/host/path or volume" : spec.leftLabel}
                                />
                            )}
                            {isVolumeSource && showLeftCustom && (
                                <button
                                    class={css.removeBtn}
                                    onClick={() => { customValue.value = false; }}
                                    title="Switch back to dropdown"
                                >
                                    ↩
                                </button>
                            )}
                        </div>
                    </div>
                    <span class={css.pairSeparator}>{sep}</span>
                    <div class={css.pairField}>
                        <span class={css.pairLabel}>{spec.rightLabel}</span>
                        <input
                            class={css.entryInput}
                            value={right}
                            onInput={(e) => updatePair(left, (e.target as HTMLInputElement).value)}
                            placeholder={spec.rightLabel}
                        />
                    </div>
                </div>
                <button class={css.removeBtn} onClick={() => onRemove(sectionIdx, entryIdx)} title="Remove">
                    ×
                </button>
            </div>
        );
    }

    // --- Select field ---
    if (spec?.fieldType === "select" && spec.options) {
        const isKnownValue = spec.options.some((o) => o.value === entry.value);
        const showCustom = customValue.value || (!isKnownValue && entry.value !== "");

        return (
            <div class={css.entryRow}>
                <span class={css.entryKeyLabel}>{entry.key}</span>
                <span class={css.entryDesc}>{spec.description}</span>
                <div class={css.inputWithAction}>
                    {showCustom ? (
                        <input
                            class={css.entryInput}
                            value={entry.value}
                            onInput={(e) => updateValue((e.target as HTMLInputElement).value)}
                            placeholder="Custom value"
                        />
                    ) : (
                        <select
                            class={css.entrySelect}
                            value={entry.value}
                            onChange={(e) => {
                                const val = (e.target as HTMLSelectElement).value;
                                if (val === "__custom__") {
                                    customValue.value = true;
                                } else {
                                    updateValue(val);
                                }
                            }}
                        >
                            <option value="">— Select —</option>
                            {spec.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.value} — {opt.description}
                                </option>
                            ))}
                            <option value="__custom__">Custom...</option>
                        </select>
                    )}
                    {showCustom && (
                        <button
                            class={css.removeBtn}
                            onClick={() => { customValue.value = false; }}
                            title="Switch back to dropdown"
                        >
                            ↩
                        </button>
                    )}
                </div>
                <button class={css.removeBtn} onClick={() => onRemove(sectionIdx, entryIdx)} title="Remove">
                    ×
                </button>
            </div>
        );
    }

    // --- Text field with resource dropdown (Image) ---
    const isImageField = entry.key === "Image" && sectionName === "Container";
    const imageOptions = isImageField ? resources.images : [];

    if (isImageField && imageOptions.length > 0) {
        const isKnownImage = imageOptions.includes(entry.value);
        const showCustomImg = customValue.value || (!isKnownImage && entry.value !== "");

        return (
            <div class={css.entryRow}>
                <span class={css.entryKeyLabel}>{entry.key}</span>
                <span class={css.entryDesc}>{spec?.description}</span>
                <div class={css.inputWithAction}>
                    {showCustomImg ? (
                        <input
                            class={css.entryInput}
                            value={entry.value}
                            onInput={(e) => updateValue((e.target as HTMLInputElement).value)}
                            placeholder="docker.io/library/nginx:latest"
                        />
                    ) : (
                        <select
                            class={css.entrySelect}
                            value={entry.value}
                            onChange={(e) => {
                                const val = (e.target as HTMLSelectElement).value;
                                if (val === "__custom__") {
                                    customValue.value = true;
                                } else {
                                    updateValue(val);
                                }
                            }}
                        >
                            <option value="">— Select image —</option>
                            {imageOptions.map((img) => (
                                <option key={img} value={img}>{img}</option>
                            ))}
                            <option value="__custom__">Custom...</option>
                        </select>
                    )}
                    {showCustomImg && (
                        <button
                            class={css.removeBtn}
                            onClick={() => { customValue.value = false; }}
                            title="Switch back to dropdown"
                        >
                            ↩
                        </button>
                    )}
                </div>
                <button class={css.removeBtn} onClick={() => onRemove(sectionIdx, entryIdx)} title="Remove">
                    ×
                </button>
            </div>
        );
    }

    // --- Text field with resource dropdown (Network) ---
    const isNetworkField = entry.key === "Network" && (sectionName === "Container" || sectionName === "Pod");
    const networkOptions = isNetworkField ? resources.networks : [];

    if (isNetworkField && networkOptions.length > 0) {
        const isKnownNetwork = networkOptions.includes(entry.value);
        const showCustomNet = customValue.value || (!isKnownNetwork && entry.value !== "");

        return (
            <div class={css.entryRow}>
                <span class={css.entryKeyLabel}>{entry.key}</span>
                <span class={css.entryDesc}>{spec?.description}</span>
                <div class={css.inputWithAction}>
                    {showCustomNet ? (
                        <input
                            class={css.entryInput}
                            value={entry.value}
                            onInput={(e) => updateValue((e.target as HTMLInputElement).value)}
                            placeholder="Network name"
                        />
                    ) : (
                        <select
                            class={css.entrySelect}
                            value={entry.value}
                            onChange={(e) => {
                                const val = (e.target as HTMLSelectElement).value;
                                if (val === "__custom__") {
                                    customValue.value = true;
                                } else {
                                    updateValue(val);
                                }
                            }}
                        >
                            <option value="">— Select network —</option>
                            {networkOptions.map((n) => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                            <option value="__custom__">Custom...</option>
                        </select>
                    )}
                    {showCustomNet && (
                        <button
                            class={css.removeBtn}
                            onClick={() => { customValue.value = false; }}
                            title="Switch back to dropdown"
                        >
                            ↩
                        </button>
                    )}
                </div>
                <button class={css.removeBtn} onClick={() => onRemove(sectionIdx, entryIdx)} title="Remove">
                    ×
                </button>
            </div>
        );
    }

    // --- Text field (mapped or custom) ---
    return (
        <div class={css.entryRow}>
            {isMapped ? (
                <>
                    <span class={css.entryKeyLabel}>{entry.key}</span>
                    <span class={css.entryDesc}>{spec?.description}</span>
                </>
            ) : (
                <input
                    class={css.entryKeyInput}
                    value={entry.key}
                    onInput={(e) =>
                        onUpdate(sectionIdx, entryIdx, {
                            key: (e.target as HTMLInputElement).value,
                            value: entry.value,
                        })
                    }
                    placeholder="Key"
                />
            )}
            <input
                class={css.entryInput}
                value={entry.value}
                onInput={(e) => updateValue((e.target as HTMLInputElement).value)}
                placeholder="Value"
            />
            <button class={css.removeBtn} onClick={() => onRemove(sectionIdx, entryIdx)} title="Remove">
                ×
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// AddDirectiveButton — dropdown to pick a directive or custom
// ---------------------------------------------------------------------------

interface AddDirectiveButtonProps {
    sectionName: string;
    existingEntries: QuadletEntry[];
    onAdd: (key: string) => void;
}

function AddDirectiveButton({ sectionName, existingEntries, onAdd }: AddDirectiveButtonProps) {
    const open = useSignal(false);
    const search = useSignal("");
    const wrapperRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open.value) return;
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                open.value = false;
                search.value = "";
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open.value]);

    // Autofocus search input when dropdown opens
    useEffect(() => {
        if (open.value && searchRef.current) {
            searchRef.current.focus();
        }
    }, [open.value]);

    const spec = getSectionSpec(sectionName);
    const existingKeys = new Set(existingEntries.map((e) => e.key));

    // Filter: available, sorted alphabetically, filtered by search
    const query = search.value.toLowerCase();
    const available = (spec?.directives ?? [])
        .filter((d) => d.repeatable || !existingKeys.has(d.key))
        .filter((d) => !query || d.key.toLowerCase().includes(query) || d.description.toLowerCase().includes(query))
        .sort((a, b) => a.key.localeCompare(b.key));

    return (
        <div class={css.dropdownWrapper} ref={wrapperRef}>
            <button class={css.addBtn} onClick={() => { open.value = !open.value; search.value = ""; }}>
                + Add directive
            </button>
            {open.value && (
                <div class={css.dropdown}>
                    <div class={css.dropdownSearch}>
                        <input
                            ref={searchRef}
                            class={css.dropdownSearchInput}
                            type="text"
                            placeholder="Search directives..."
                            value={search.value}
                            onInput={(e) => { search.value = (e.target as HTMLInputElement).value; }}
                        />
                    </div>
                    {available.map((d) => (
                        <div
                            key={d.key}
                            class={css.dropdownItem}
                            onClick={() => {
                                onAdd(d.key);
                                open.value = false;
                                search.value = "";
                            }}
                        >
                            <span class={css.dropdownItemKey}>{d.key}</span>
                            <span class={css.dropdownItemDesc}>{d.description}</span>
                        </div>
                    ))}
                    {(!query || "custom".includes(query)) && (
                        <div
                            class={css.dropdownItem}
                            onClick={() => {
                                onAdd("");
                                open.value = false;
                                search.value = "";
                            }}
                        >
                            <span class={css.dropdownItemKey}>Custom</span>
                            <span class={css.dropdownItemDesc}>Add a custom directive</span>
                        </div>
                    )}
                    {available.length === 0 && query && !("custom".includes(query)) && (
                        <div class={css.dropdownItem} style={{ opacity: 0.5, cursor: "default" }}>
                            <span class={css.dropdownItemDesc}>No directives found</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// AddSectionButton — dropdown to add a new section
// ---------------------------------------------------------------------------

interface AddSectionButtonProps {
    existingSections: string[];
    onAdd: (name: string) => void;
}

function AddSectionButton({ existingSections, onAdd }: AddSectionButtonProps) {
    const open = useSignal(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open.value) return;
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                open.value = false;
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open.value]);

    const existing = new Set(existingSections);
    const available = SECTIONS.filter((s) => !existing.has(s.name));

    if (available.length === 0) return null;

    return (
        <div class={css.dropdownWrapper} ref={wrapperRef}>
            <button class={css.addSectionBtn} onClick={() => { open.value = !open.value; }}>
                + Add section
            </button>
            {open.value && (
                <div class={css.dropdown}>
                    {available.map((s) => (
                        <div
                            key={s.name}
                            class={css.dropdownItem}
                            onClick={() => {
                                onAdd(s.name);
                                open.value = false;
                            }}
                        >
                            <span class={css.dropdownItemKey}>[{s.name}]</span>
                            <span class={css.dropdownItemDesc}>{s.description}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
