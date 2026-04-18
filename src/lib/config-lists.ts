export function parseIdListFromString(value: string | null | undefined): string[] {
    if (!value) {
        return [];
    }

    const seen = new Set<string>();

    for (const raw of value.split(/[\n,;]+/g)) {
        const trimmed = raw.trim();

        if (!trimmed) {
            continue;
        }

        seen.add(trimmed);
    }

    return Array.from(seen);
}

export function parseIdListInput(value: unknown): string[] {
    if (Array.isArray(value)) {
        const seen = new Set<string>();

        for (const item of value) {
            if (typeof item !== "string") {
                continue;
            }

            const trimmed = item.trim();

            if (!trimmed) {
                continue;
            }

            seen.add(trimmed);
        }

        return Array.from(seen);
    }

    if (typeof value === "string") {
        return parseIdListFromString(value);
    }

    return [];
}

export function serializeIdList(ids: string[]): string | null {
    return ids.length > 0 ? ids.join(",") : null;
}

export function firstId(ids: string[]): string | null {
    return ids[0] ?? null;
}
