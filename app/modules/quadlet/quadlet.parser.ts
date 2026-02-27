export interface QuadletEntry {
    key: string;
    value: string;
}

export interface QuadletSection {
    name: string;
    entries: QuadletEntry[];
}

export function parseQuadlet(text: string): QuadletSection[] {
    const sections: QuadletSection[] = [];
    let current: QuadletSection | null = null;

    for (const raw of text.split("\n")) {
        const line = raw.trim();

        // Skip empty lines and comments
        if (!line || line.startsWith("#") || line.startsWith(";")) continue;

        // Section header
        const sectionMatch = line.match(/^\[(.+)\]$/);
        if (sectionMatch) {
            current = { name: sectionMatch[1]!, entries: [] };
            sections.push(current);
            continue;
        }

        // Key=Value entry
        if (current) {
            const eqIdx = line.indexOf("=");
            if (eqIdx >= 0) {
                current.entries.push({
                    key: line.slice(0, eqIdx).trim(),
                    value: line.slice(eqIdx + 1).trim(),
                });
            }
        }
    }

    return sections;
}

export function serializeQuadlet(sections: QuadletSection[]): string {
    const parts: string[] = [];

    for (const section of sections) {
        parts.push(`[${section.name}]`);
        for (const entry of section.entries) {
            parts.push(`${entry.key}=${entry.value}`);
        }
        parts.push("");
    }

    return parts.join("\n");
}
