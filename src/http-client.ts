/**
 * HTTP client interface for abstracting HTTP operations
 */
export interface HttpClient {
    /**
     * Make an HTTP request
     * @param url The URL to request
     * @param options Request options
     * @returns Response or null if request failed
     */
    request<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T> | null>;
}

export interface HttpRequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
    signal?: AbortSignal;
}

export interface HttpResponse<T> {
    ok: boolean;
    status: number;
    statusText: string;
    json(): Promise<T>;
}

/**
 * HTTP client implementation using fetch
 */
export class FetchHttpClient implements HttpClient {
    private readonly fetch: typeof fetch;

    constructor(fetchFn: typeof fetch = fetch) {
        this.fetch = fetchFn;
    }

    async request<T>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T> | null> {
        const controller = new AbortController();
        const timeout = options.timeout ? setTimeout(() => controller.abort(), options.timeout) : undefined;

        try {
            const fetchOptions: RequestInit = {
                method: options.method || 'GET',
                signal: options.signal || controller.signal,
                headers: options.headers || {},
            };

            if (options.body) {
                fetchOptions.body = options.body;
            }

            const response = await this.fetch(url, fetchOptions);

            return {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                json: () => response.json() as Promise<T>,
            };
        } catch {
            // Let the calling code handle the error
            return null;
        } finally {
            if (timeout) {
                clearTimeout(timeout);
            }
        }
    }
}
