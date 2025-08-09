import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FetchHttpClient } from './http-client.ts';

describe('FetchHttpClient', () => {
    let httpClient: FetchHttpClient;
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockFetch = vi.fn<typeof fetch>();
        httpClient = new FetchHttpClient(mockFetch as typeof fetch);
    });

    describe('constructor', () => {
        it('should use default fetch when no fetch function is provided', (): void => {
            const defaultClient = new FetchHttpClient();
            expect(defaultClient).toBeDefined();
        });

        it('should use provided fetch function', (): void => {
            const customFetch = vi.fn();
            const customClient = new FetchHttpClient(customFetch as typeof fetch);
            expect(customClient).toBeDefined();
        });
    });

    describe('request', () => {
        it('should make a successful GET request', async (): Promise<void> => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async (): Promise<Record<string, unknown>> => ({ message: 'success' }),
            };

            mockFetch.mockResolvedValue(mockResponse);

            const response = await httpClient.request('http://example.com/api/test');

            expect(response).toBeDefined();
            expect(response?.ok).toBe(true);
            expect(response?.status).toBe(200);
            expect(await response?.json()).toEqual({ message: 'success' });

            expect(mockFetch).toHaveBeenCalledWith(
                'http://example.com/api/test',
                expect.objectContaining({
                    method: 'GET',
                    headers: {},
                }),
            );
        });

        it('should make a POST request with body', async (): Promise<void> => {
            const mockResponse = {
                ok: true,
                status: 201,
                statusText: 'Created',
                json: async (): Promise<Record<string, unknown>> => ({ id: 123 }),
            };

            mockFetch.mockResolvedValue(mockResponse);

            const response = await httpClient.request('http://example.com/api/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'test' }),
            });

            expect(response).toBeDefined();
            expect(response?.ok).toBe(true);
            expect(response?.status).toBe(201);

            expect(mockFetch).toHaveBeenCalledWith(
                'http://example.com/api/test',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{"name":"test"}',
                }),
            );
        });

        it('should handle network errors', async (): Promise<void> => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            const response = await httpClient.request('http://example.com/api/test');

            expect(response).toBeNull();
        });

        it('should handle timeout', async (): Promise<void> => {
            // Mock a request that simulates an abort due to timeout
            mockFetch.mockImplementation(() =>
                Promise.reject(new DOMException('The operation was aborted', 'AbortError')),
            );

            const response = await httpClient.request('http://example.com/api/test', {
                timeout: 100, // 100ms timeout
            });

            expect(response).toBeNull();
        });

        it('should return response even when not ok', async (): Promise<void> => {
            const mockResponse = {
                ok: false,
                status: 404,
                statusText: 'Not Found',
                json: async (): Promise<Record<string, unknown>> => ({ error: 'Not found' }),
            };

            mockFetch.mockResolvedValue(mockResponse);

            const response = await httpClient.request('http://example.com/api/test');

            expect(response).toBeDefined();
            expect(response?.ok).toBe(false);
            expect(response?.status).toBe(404);
            expect(response?.statusText).toBe('Not Found');
        });

        it('should use default GET method when not specified', async (): Promise<void> => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async (): Promise<Record<string, unknown>> => ({}),
            };

            mockFetch.mockResolvedValue(mockResponse);

            await httpClient.request('http://example.com/api/test');

            expect(mockFetch).toHaveBeenCalledWith(
                'http://example.com/api/test',
                expect.objectContaining({
                    method: 'GET',
                }),
            );
        });

        it('should use provided abort signal', async (): Promise<void> => {
            const mockResponse = {
                ok: true,
                status: 200,
                statusText: 'OK',
                json: async (): Promise<Record<string, unknown>> => ({}),
            };

            mockFetch.mockResolvedValue(mockResponse);

            const controller = new AbortController();
            await httpClient.request('http://example.com/api/test', {
                signal: controller.signal,
            });

            expect(mockFetch).toHaveBeenCalledWith(
                'http://example.com/api/test',
                expect.objectContaining({
                    signal: controller.signal,
                }),
            );
        });
    });
});
