import { EventEmitter } from 'node:events';
import { logger } from './logger.ts';
import type { HttpClient } from './http-client.ts';
import {
    EXPORTER_INFO,
    OLLAMA_UP,
    OLLAMA_VERSION_INFO,
    OLLAMA_MODELS_TOTAL,
    OLLAMA_MODEL_INFO,
    OLLAMA_MODEL_SIZE_BYTES,
    OLLAMA_MODEL_MODIFIED_TIMESTAMP,
    OLLAMA_RUNNING_MODELS,
    OLLAMA_MODEL_MEMORY_BYTES,
    OLLAMA_EXPORTER_SCRAPE_DURATION,
    OLLAMA_EXPORTER_SCRAPES_TOTAL,
    OLLAMA_EXPORTER_LAST_SCRAPE_TIMESTAMP,
} from './metrics.ts';
import { VERSION } from './index.ts';

interface OllamaModel {
    name: string;
    size: number;
    modified_at: string;
    details: {
        family?: string;
        format?: string;
        parameter_size?: string;
        quantization_level?: string;
        parent_model?: string;
    };
}

interface OllamaRunningModel {
    name: string;
    size_vram: number;
}

interface OllamaVersionResponse {
    version: string;
}

interface OllamaTagsResponse {
    models: OllamaModel[];
}

interface OllamaPsResponse {
    models: OllamaRunningModel[];
}

export class OllamaExporter extends EventEmitter {
    private baseUrl: string;
    private apiTimeout: number;
    private httpClient: HttpClient;
    private shutdownEvent = false;
    private lastModels: Map<string, OllamaModel> = new Map<string, OllamaModel>();
    private lastRunningModels = new Set<string>();
    private metricsInterval?: NodeJS.Timeout;

    constructor(ollamaHost: string, apiTimeout: number, httpClient: HttpClient) {
        super();
        this.baseUrl = `http://${ollamaHost}/api`;
        this.apiTimeout = apiTimeout * 1000; // Convert to milliseconds
        this.httpClient = httpClient;

        EXPORTER_INFO.labels(VERSION, ollamaHost, process.version).set(1);
    }

    isShuttingDown(): boolean {
        return this.shutdownEvent;
    }

    private async apiRequest<T>(endpoint: string, method = 'GET', data?: unknown): Promise<T | null> {
        try {
            const url = `${this.baseUrl}/${endpoint}`;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            let body: string | undefined;
            if (data) {
                body = JSON.stringify(data);
            }

            const response = await this.httpClient.request<T>(url, {
                method,
                headers,
                body,
                timeout: this.apiTimeout,
            });

            if (!response) {
                logger.error(`API request failed for ${endpoint}`);
                return null;
            }

            if (!response.ok) {
                logger.error(`API request failed: ${response.status} ${response.statusText}`);
                return null;
            }

            return await response.json();
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`API request error for ${endpoint}: ${error.message}`);
            }
            return null;
        }
    }

    async checkOllamaHealth(): Promise<boolean> {
        const versionData = await this.apiRequest<OllamaVersionResponse>('version');
        if (versionData) {
            OLLAMA_VERSION_INFO.labels(versionData.version || 'unknown').set(1);
            return true;
        }
        return false;
    }

    private async updateModelMetrics(): Promise<boolean> {
        const endTimer = OLLAMA_EXPORTER_SCRAPE_DURATION.startTimer({ operation: 'list_models' });
        const data = await this.apiRequest<OllamaTagsResponse>('tags');
        endTimer();

        if (!data) {
            return false;
        }

        try {
            const models = data.models || [];

            // Remove metrics for models that no longer exist
            const currentModels = new Set(models.map((m) => m.name || 'unknown'));
            for (const oldModel of this.lastModels.keys()) {
                if (!currentModels.has(oldModel)) {
                    OLLAMA_MODEL_SIZE_BYTES.remove(oldModel);
                    OLLAMA_MODEL_MODIFIED_TIMESTAMP.remove(oldModel);
                    OLLAMA_MODEL_INFO.remove(oldModel);
                }
            }

            OLLAMA_MODELS_TOTAL.set(models.length);

            for (const model of models) {
                const name = model.name || 'unknown';
                const size = model.size || 0;
                const modifiedAt = model.modified_at || '';
                const details = model.details || {};

                OLLAMA_MODEL_INFO.labels(
                    name,
                    details.family || 'unknown',
                    details.format || 'unknown',
                    details.parameter_size || 'unknown',
                    details.quantization_level || 'unknown',
                    details.parent_model || 'unknown',
                ).set(1);

                OLLAMA_MODEL_SIZE_BYTES.labels(name).set(size);

                if (modifiedAt) {
                    try {
                        const dt = new Date(modifiedAt);
                        OLLAMA_MODEL_MODIFIED_TIMESTAMP.labels(name).set(dt.getTime() / 1000);
                    } catch (e) {
                        logger.debug(`Could not parse timestamp ${modifiedAt}: ${e}`);
                    }
                }
            }

            this.lastModels = new Map(models.map((m) => [m.name || 'unknown', m]));
            return true;
        } catch (error) {
            logger.error(`Error processing models: ${error}`);
            return false;
        }
    }

    private async updateRunningMetrics(): Promise<boolean> {
        const endTimer = OLLAMA_EXPORTER_SCRAPE_DURATION.startTimer({ operation: 'list_running' });
        const data = await this.apiRequest<OllamaPsResponse>('ps');
        endTimer();

        if (!data) {
            return false;
        }

        try {
            // Clear old running model metrics
            for (const oldModel of this.lastRunningModels) {
                OLLAMA_RUNNING_MODELS.remove(oldModel);
                OLLAMA_MODEL_MEMORY_BYTES.remove(oldModel);
            }

            const models = data.models || [];
            const currentRunning = new Set<string>();

            for (const model of models) {
                const name = model.name || 'unknown';
                const sizeVram = model.size_vram || 0;

                currentRunning.add(name);
                OLLAMA_RUNNING_MODELS.labels(name).set(1);

                if (sizeVram > 0) {
                    OLLAMA_MODEL_MEMORY_BYTES.labels(name).set(sizeVram);
                }
            }

            this.lastRunningModels = currentRunning;
            return true;
        } catch (error) {
            logger.error(`Error processing running models: ${error}`);
            return false;
        }
    }

    async updateMetrics(): Promise<void> {
        let success = true;

        try {
            const ollamaUp = await this.checkOllamaHealth();
            OLLAMA_UP.set(ollamaUp ? 1 : 0);

            if (!ollamaUp) {
                success = false;
                logger.warning('Ollama API is not responding');
            } else {
                if (!(await this.updateModelMetrics())) {
                    success = false;
                }

                if (!(await this.updateRunningMetrics())) {
                    success = false;
                }

                logger.info(
                    `Updated metrics: ${this.lastModels.size} total models, ${this.lastRunningModels.size} running`,
                );
            }

            if (success) {
                OLLAMA_EXPORTER_LAST_SCRAPE_TIMESTAMP.set(Date.now() / 1000);
            }
        } catch (error) {
            logger.error(`Error in metrics update: ${error}`);
            success = false;
        }

        const status = success ? 'success' : 'error';
        OLLAMA_EXPORTER_SCRAPES_TOTAL.labels(status).inc();
    }

    startMetricsLoop(interval: number): void {
        const metricsLoop = async (): Promise<void> => {
            if (!this.shutdownEvent) {
                await this.updateMetrics();
            }
        };

        this.metricsInterval = setInterval(metricsLoop, interval * 1000);
    }

    shutdown(): void {
        logger.info('Shutting down exporter');
        this.shutdownEvent = true;
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        this.emit('shutdown');
    }
}
