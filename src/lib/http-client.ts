type ErrorPayload = {
    error?: string;
    message?: string;
};

export class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

async function parseErrorMessage(response: Response, fallback: string) {
    const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
    return payload?.error ?? payload?.message ?? fallback;
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
        const message = await parseErrorMessage(response, fallbackError);
        throw new ApiError(response.status, message);
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
        const message = await parseErrorMessage(response, fallbackError);
        throw new ApiError(response.status, message);
    }
}
