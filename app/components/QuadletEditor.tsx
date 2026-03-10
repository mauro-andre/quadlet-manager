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
    type SectionSpec,
} from "../modules/quadlet/quadlet.directives.js";
import * as css from "./QuadletEditor.css.js";

interface PodmanResources {
    images: string[];
    volumes: string[];
    networks: string[];
    pods: string[];
}

export interface SectionsConfig {
    allSections: SectionSpec[];
    getSectionSpec: (name: string) => SectionSpec | undefined;
    getDirectiveSpec: (sectionName: string, key: string) => DirectiveSpec | undefined;
}

const defaultSectionsConfig: SectionsConfig = {
    allSections: SECTIONS,
    getSectionSpec,
    getDirectiveSpec,
};

interface QuadletEditorProps {
    content: Signal<string>;
    sectionsConfig?: SectionsConfig;
    fetchResources?: boolean;
}

export function QuadletEditor({ content, sectionsConfig, fetchResources = true }: QuadletEditorProps) {
    const config = sectionsConfig ?? defaultSectionsConfig;
    const mode = useSignal<"form" | "code">("form");
    const sections = useSignal<QuadletSection[]>(parseQuadlet(content.value));
    const revision = useSignal(0);
    const resources = useSignal<PodmanResources>({ images: [], volumes: [], networks: [], pods: [] });

    // Fetch available images, volumes, networks and pods for form dropdowns
    useEffect(() => {
        if (typeof window === "undefined" || !fetchResources) return;
        Promise.all([
            fetch("/api/podman/images").then((r) => r.json()).catch(() => []),
            fetch("/api/podman/volumes").then((r) => r.json()).catch(() => []),
            fetch("/api/podman/networks").then((r) => r.json()).catch(() => []),
            fetch("/api/podman/pods").then((r) => r.json()).catch(() => []),
        ]).then(([images, volumes, networks, pods]) => {
            resources.value = { images, volumes, networks, pods };
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
                            config={config}
                            onAddEntry={addEntry}
                            onUpdateEntry={updateEntry}
                            onRemoveEntry={removeEntry}
                            onRemoveSection={removeSection}
                        />
                    ))}
                    <AddSectionButton
                        existingSections={sections.value.map((s) => s.name)}
                        allSections={config.allSections}
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
    config: SectionsConfig;
    onAddEntry: (sectionIdx: number, key: string, value: string) => void;
    onUpdateEntry: (sectionIdx: number, entryIdx: number, entry: QuadletEntry) => void;
    onRemoveEntry: (sectionIdx: number, entryIdx: number) => void;
    onRemoveSection: (idx: number) => void;
}

function SectionCard({
    section,
    sectionIdx,
    resources,
    config,
    onAddEntry,
    onUpdateEntry,
    onRemoveEntry,
    onRemoveSection,
}: SectionCardProps) {
    const spec = config.getSectionSpec(section.name);

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
                        config={config}
                        onUpdate={onUpdateEntry}
                        onRemove={onRemoveEntry}
                    />
                ))}
            </div>
            <div class={css.addRow}>
                <AddDirectiveButton
                    sectionName={section.name}
                    existingEntries={section.entries}
                    config={config}
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
    config: SectionsConfig;
    onUpdate: (sectionIdx: number, entryIdx: number, entry: QuadletEntry) => void;
    onRemove: (sectionIdx: number, entryIdx: number) => void;
}

function EntryRow({ sectionName, entry, sectionIdx, entryIdx, resources, config, onUpdate, onRemove }: EntryRowProps) {
    const spec = config.getDirectiveSpec(sectionName, entry.key);
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
                                <SearchableSelect
                                    options={volumeOptions}
                                    value={leftIsVolume ? left : ""}
                                    placeholder="Select volume"
                                    onChange={(val) => updatePair(val, right)}
                                    onCustom={() => {
                                        customValue.value = true;
                                        updatePair("", right);
                                    }}
                                />
                            ) : (
                                <>
                                    <input
                                        class={css.entryInput}
                                        value={left}
                                        onInput={(e) => updatePair((e.target as HTMLInputElement).value, right)}
                                        placeholder={isVolumeSource ? "/host/path or volume" : spec.leftLabel}
                                    />
                                    {isVolumeSource && showLeftCustom && (
                                        <button
                                            class={css.removeBtn}
                                            onClick={() => { customValue.value = false; }}
                                            title="Switch back to dropdown"
                                        >
                                            ↩
                                        </button>
                                    )}
                                </>
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
                        <>
                            <input
                                class={css.entryInput}
                                value={entry.value}
                                onInput={(e) => updateValue((e.target as HTMLInputElement).value)}
                                placeholder="Custom value"
                            />
                            <button
                                class={css.removeBtn}
                                onClick={() => { customValue.value = false; }}
                                title="Switch back to dropdown"
                            >
                                ↩
                            </button>
                        </>
                    ) : (
                        <SearchableSelect
                            options={spec.options.map((o) => o.value)}
                            value={entry.value}
                            placeholder="Select"
                            onChange={updateValue}
                            onCustom={() => { customValue.value = true; }}
                        />
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
                        <>
                            <input
                                class={css.entryInput}
                                value={entry.value}
                                onInput={(e) => updateValue((e.target as HTMLInputElement).value)}
                                placeholder="docker.io/library/nginx:latest"
                            />
                            <button
                                class={css.removeBtn}
                                onClick={() => { customValue.value = false; }}
                                title="Switch back to dropdown"
                            >
                                ↩
                            </button>
                        </>
                    ) : (
                        <SearchableSelect
                            options={imageOptions}
                            value={entry.value}
                            placeholder="Select image"
                            onChange={updateValue}
                            onCustom={() => { customValue.value = true; }}
                        />
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
                        <>
                            <input
                                class={css.entryInput}
                                value={entry.value}
                                onInput={(e) => updateValue((e.target as HTMLInputElement).value)}
                                placeholder="Network name"
                            />
                            <button
                                class={css.removeBtn}
                                onClick={() => { customValue.value = false; }}
                                title="Switch back to dropdown"
                            >
                                ↩
                            </button>
                        </>
                    ) : (
                        <SearchableSelect
                            options={networkOptions}
                            value={entry.value}
                            placeholder="Select network"
                            onChange={updateValue}
                            onCustom={() => { customValue.value = true; }}
                        />
                    )}
                </div>
                <button class={css.removeBtn} onClick={() => onRemove(sectionIdx, entryIdx)} title="Remove">
                    ×
                </button>
            </div>
        );
    }

    // --- Text field with resource dropdown (Pod) ---
    const isPodField = entry.key === "Pod" && sectionName === "Container";
    const podOptions = isPodField ? resources.pods : [];

    if (isPodField && podOptions.length > 0) {
        const isKnownPod = podOptions.includes(entry.value);
        const showCustomPod = customValue.value || (!isKnownPod && entry.value !== "");

        return (
            <div class={css.entryRow}>
                <span class={css.entryKeyLabel}>{entry.key}</span>
                <span class={css.entryDesc}>{spec?.description}</span>
                <div class={css.inputWithAction}>
                    {showCustomPod ? (
                        <>
                            <input
                                class={css.entryInput}
                                value={entry.value}
                                onInput={(e) => updateValue((e.target as HTMLInputElement).value)}
                                placeholder="my-pod.pod"
                            />
                            <button
                                class={css.removeBtn}
                                onClick={() => { customValue.value = false; }}
                                title="Switch back to dropdown"
                            >
                                ↩
                            </button>
                        </>
                    ) : (
                        <SearchableSelect
                            options={podOptions}
                            value={entry.value}
                            placeholder="Select pod"
                            onChange={updateValue}
                            onCustom={() => { customValue.value = true; }}
                        />
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
// SearchableSelect — custom dropdown with search filter
// ---------------------------------------------------------------------------

interface SearchableSelectProps {
    options: string[];
    value: string;
    placeholder: string;
    onChange: (value: string) => void;
    onCustom: () => void;
}

function SearchableSelect({ options, value, placeholder, onChange, onCustom }: SearchableSelectProps) {
    const open = useSignal(false);
    const search = useSignal("");
    const wrapperRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

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

    useEffect(() => {
        if (open.value && searchRef.current) {
            searchRef.current.focus();
        }
    }, [open.value]);

    const query = search.value.toLowerCase();
    const sorted = [...options].sort((a, b) => a.localeCompare(b));
    const filtered = sorted.filter((o) => !query || o.toLowerCase().includes(query));

    return (
        <div class={css.dropdownWrapper} ref={wrapperRef} style={{ flex: 1, minWidth: 0 }}>
            <button
                type="button"
                class={css.selectTrigger}
                onClick={() => { open.value = !open.value; search.value = ""; }}
            >
                {value ? (
                    <span class={css.selectTriggerValue}>{value}</span>
                ) : (
                    <span class={css.selectTriggerPlaceholder}>{placeholder}</span>
                )}
                <span class={css.selectTriggerArrow}>▼</span>
            </button>
            {open.value && (
                <div class={css.selectDropdown}>
                    <div class={css.dropdownSearch}>
                        <input
                            ref={searchRef}
                            class={css.dropdownSearchInput}
                            type="text"
                            placeholder="Search..."
                            value={search.value}
                            onInput={(e) => { search.value = (e.target as HTMLInputElement).value; }}
                        />
                    </div>
                    {filtered.map((opt) => (
                        <div
                            key={opt}
                            class={css.dropdownItem}
                            onClick={() => {
                                onChange(opt);
                                open.value = false;
                                search.value = "";
                            }}
                        >
                            <span class={css.dropdownItemKey}>{opt}</span>
                        </div>
                    ))}
                    {(!query || "custom".includes(query)) && (
                        <div
                            class={css.dropdownItem}
                            onClick={() => {
                                onCustom();
                                open.value = false;
                                search.value = "";
                            }}
                        >
                            <span class={css.dropdownItemKey}>Custom...</span>
                            <span class={css.dropdownItemDesc}>Enter a custom value</span>
                        </div>
                    )}
                    {filtered.length === 0 && query && !("custom".includes(query)) && (
                        <div class={css.dropdownItem} style={{ opacity: 0.5, cursor: "default" }}>
                            <span class={css.dropdownItemDesc}>No results found</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// AddDirectiveButton — dropdown to pick a directive or custom
// ---------------------------------------------------------------------------

interface AddDirectiveButtonProps {
    sectionName: string;
    existingEntries: QuadletEntry[];
    config: SectionsConfig;
    onAdd: (key: string) => void;
}

function AddDirectiveButton({ sectionName, existingEntries, config, onAdd }: AddDirectiveButtonProps) {
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

    const spec = config.getSectionSpec(sectionName);
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
    allSections: SectionSpec[];
    onAdd: (name: string) => void;
}

function AddSectionButton({ existingSections, allSections, onAdd }: AddSectionButtonProps) {
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
    const available = allSections.filter((s) => !existing.has(s.name));

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
