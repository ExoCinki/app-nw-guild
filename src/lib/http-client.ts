type ErrorPayload = {
    error?: string;
    message?: string;
    debug?: unknown;
};

export class ApiError extends Error {
    status: number;
    debug?: unknown;

    constructor(status: number, message: string, debug?: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.debug = debug;
    }
}

async function parseErrorPayload(response: Response, fallback: string) {
    const payload = (await response.json().catch(() => null)) as ErrorPayload | null;

    return {
        message: payload?.error ?? payload?.message ?? fallback,
        debug: payload?.debug,
    };
}

export async function apiFetch<T>(
    input: RequestInfo | URL,
    init: RequestInit = {},
    fallbackError = "Request failed",
): Promise<T> {
    const response = await fetch(input, {
        credentials: "include",
        ...init,
    });

    if (!response.ok) {
        const payload = await parseErrorPayload(response, fallbackError);
        throw new ApiError(response.status, payload.message, payload.debug);
    }

    return response.json() as Promise<T>;
}

export async function apiFetchVoid(
    input: RequestInfo | URL,
    init: RequestInit = {},
    fallbackError = "Request failed",
): Promise<void> {
    const response = await fetch(input, {
        credentials: "include",
        ...init,
    });

    if (!response.ok) {
        const payload = await parseErrorPayload(response, fallbackError);
        throw new ApiError(response.status, payload.message, payload.debug);
    }
}
