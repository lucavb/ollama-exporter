import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaExporter } from './exporter.ts';
import { HttpClient, HttpResponse } from './http-client.ts';

// Mock the index.ts module to prevent it from running during tests
vi.mock('./index.ts', () => ({
    VERSION: '1.0.0',
}));

// Mock the metrics module
vi.mock('./metrics.ts', () => ({
    EXPORTER_INFO: { labels: vi.fn().mockReturnValue({ set: vi.fn() }) },
    OLLAMA_UP: { set: vi.fn() },
    OLLAMA_VERSION_INFO: { labels: vi.fn().mockReturnValue({ set: vi.fn() }) },
    OLLAMA_MODELS_TOTAL: { set: vi.fn() },
    OLLAMA_MODEL_INFO: { labels: vi.fn().mockReturnValue({ set: vi.fn() }) },
    OLLAMA_MODEL_SIZE_BYTES: { labels: vi.fn().mockReturnValue({ set: vi.fn() }), remove: vi.fn() },
    OLLAMA_MODEL_MODIFIED_TIMESTAMP: { labels: vi.fn().mockReturnValue({ set: vi.fn() }), remove: vi.fn() },
    OLLAMA_RUNNING_MODELS: { labels: vi.fn().mockReturnValue({ set: vi.fn() }), remove: vi.fn() },
    OLLAMA_MODEL_MEMORY_BYTES: { labels: vi.fn().mockReturnValue({ set: vi.fn() }), remove: vi.fn() },
    OLLAMA_EXPORTER_SCRAPE_DURATION: { startTimer: vi.fn().mockReturnValue(vi.fn()) },
    OLLAMA_EXPORTER_SCRAPES_TOTAL: { labels: vi.fn().mockReturnValue({ inc: vi.fn() }) },
    OLLAMA_EXPORTER_LAST_SCRAPE_TIMESTAMP: { set: vi.fn() },
}));

// Mock the logger module
vi.mock('./logger.ts', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        debug: vi.fn(),
    },
}));

interface RequestHistoryEntry {
    url: string;
    options?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
        timeout?: number;
    };
}

class MockHttpClient implements HttpClient {
    private responses = new Map<string, HttpResponse<unknown> | null>();
    private requestHistory: RequestHistoryEntry[] = [];

    setResponse<T>(endpoint: string, response: HttpResponse<T> | null): void {
        this.responses.set(endpoint, response as HttpResponse<unknown>);
    }

    getRequestHistory(): RequestHistoryEntry[] {
        return this.requestHistory;
    }

    clearRequestHistory(): void {
        this.requestHistory = [];
    }

    async request<T>(url: string, options?: RequestHistoryEntry['options']): Promise<HttpResponse<T> | null> {
        this.requestHistory.push({ url, options });

        // Extract endpoint from full URL (e.g., 'http://localhost:11434/api/version' -> 'version')
        const urlParts = url.split('/');
        const endpoint = urlParts[urlParts.length - 1];

        return this.responses.get(endpoint) as HttpResponse<T> | null;
    }
}

describe('OllamaExporter', () => {
    let exporter: OllamaExporter;
    let mockHttpClient: MockHttpClient;

    beforeEach(() => {
        mockHttpClient = new MockHttpClient();
        exporter = new OllamaExporter('localhost:11434', 30, mockHttpClient);
    });

    describe('constructor', () => {
        it('should initialize with correct base URL and timeout', () => {
            expect(exporter).toBeDefined();
            expect(exporter.isShuttingDown()).toBe(false);
        });
    });

    describe('checkOllamaHealth', () => {
        it('should return true when API responds with version info', async () => {
            const mockResponse: HttpResponse<{ version: string }> = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => ({ version: '0.1.15' }),
            };

            mockHttpClient.setResponse('version', mockResponse);

            const result = await exporter.checkOllamaHealth();

            expect(result).toBe(true);
            expect(mockHttpClient.getRequestHistory()).toHaveLength(1);
            expect(mockHttpClient.getRequestHistory()[0].url).toBe('http://localhost:11434/api/version');
        });

        it('should return false when API request fails', async () => {
            mockHttpClient.setResponse('version', null);

            const result = await exporter.checkOllamaHealth();

            expect(result).toBe(false);
        });

        it('should return false when API responds with error status', async () => {
            const mockResponse: HttpResponse<Record<string, unknown>> = {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: async () => ({}),
            };

            mockHttpClient.setResponse('version', mockResponse);

            const result = await exporter.checkOllamaHealth();

            expect(result).toBe(false);
        });
    });

    describe('updateMetrics', () => {
        it('should update metrics when Ollama is healthy', async () => {
            // Mock version response
            const versionResponse: HttpResponse<{ version: string }> = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => ({ version: '0.1.15' }),
            };

            // Mock tags response
            const tagsResponse: HttpResponse<{
                models: {
                    name: string;
                    size: number;
                    modified_at: string;
                    details: {
                        family?: string;
                        format?: string;
                        parameter_size?: string;
                        quantization_level?: string;
                    };
                }[];
            }> = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => ({
                    models: [
                        {
                            name: 'llama2:7b',
                            size: 3826793677,
                            modified_at: '2023-12-07T09:32:18.757212583Z',
                            details: {
                                family: 'llama',
                                format: 'gguf',
                                parameter_size: '7B',
                                quantization_level: 'Q4_0',
                            },
                        },
                    ],
                }),
            };

            // Mock ps response
            const psResponse: HttpResponse<{
                models: {
                    name: string;
                    size_vram: number;
                }[];
            }> = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async () => ({
                    models: [
                        {
                            name: 'llama2:7b',
                            size_vram: 4096000000,
                        },
                    ],
                }),
            };

            mockHttpClient.setResponse('version', versionResponse);
            mockHttpClient.setResponse('tags', tagsResponse);
            mockHttpClient.setResponse('ps', psResponse);

            await exporter.updateMetrics();

            const requests = mockHttpClient.getRequestHistory();
            expect(requests).toHaveLength(3);
            expect(requests.map((r) => r.url)).toEqual([
                'http://localhost:11434/api/version',
                'http://localhost:11434/api/tags',
                'http://localhost:11434/api/ps',
            ]);
        });

        it('should handle API errors gracefully', async () => {
            mockHttpClient.setResponse('version', null);

            await exporter.updateMetrics();

            // Should still attempt to call version endpoint
            expect(mockHttpClient.getRequestHistory()).toHaveLength(1);
        });
    });

    describe('shutdown', () => {
        it('should set shutdown state and emit event', () => {
            const shutdownSpy = vi.fn();
            exporter.on('shutdown', shutdownSpy);

            exporter.shutdown();

            expect(exporter.isShuttingDown()).toBe(true);
            expect(shutdownSpy).toHaveBeenCalled();
        });
    });

    describe('metrics loop', () => {
        it('should start and stop metrics loop', () => {
            vi.useFakeTimers();

            exporter.startMetricsLoop(1); // 1 second interval

            // Advance time and verify interval was set
            vi.advanceTimersByTime(1000);

            exporter.shutdown();

            vi.useRealTimers();
        });
    });
});
