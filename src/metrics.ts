import { Registry, Gauge, Counter, Histogram } from 'prom-client';

// Create a custom registry
export const REGISTRY = new Registry();

// Exporter metrics
export const EXPORTER_INFO = new Gauge<'version' | 'ollama_host' | 'node_version'>({
    name: 'ollama_exporter_build_info',
    help: 'Ollama exporter build information',
    labelNames: ['version', 'ollama_host', 'node_version'],
    registers: [REGISTRY],
});

// Ollama server metrics
export const OLLAMA_UP = new Gauge({
    name: 'ollama_up',
    help: 'Whether the Ollama server is responding',
    registers: [REGISTRY],
});

export const OLLAMA_VERSION_INFO = new Gauge<'version'>({
    name: 'ollama_version_info',
    help: 'Ollama version information',
    labelNames: ['version'],
    registers: [REGISTRY],
});

// Model metrics
export const OLLAMA_MODELS_TOTAL = new Gauge({
    name: 'ollama_models_total',
    help: 'Total number of models available',
    registers: [REGISTRY],
});

export const OLLAMA_MODEL_INFO = new Gauge<
    'model_name' | 'family' | 'format' | 'parameter_size' | 'quantization_level' | 'parent_model'
>({
    name: 'ollama_model_info',
    help: 'Model information',
    labelNames: ['model_name', 'family', 'format', 'parameter_size', 'quantization_level', 'parent_model'],
    registers: [REGISTRY],
});

export const OLLAMA_MODEL_SIZE_BYTES = new Gauge<'model_name'>({
    name: 'ollama_model_size_bytes',
    help: 'Model size in bytes',
    labelNames: ['model_name'],
    registers: [REGISTRY],
});

export const OLLAMA_MODEL_MODIFIED_TIMESTAMP = new Gauge<'model_name'>({
    name: 'ollama_model_modified_timestamp_seconds',
    help: 'Model last modified timestamp',
    labelNames: ['model_name'],
    registers: [REGISTRY],
});

// Running model metrics
export const OLLAMA_RUNNING_MODELS = new Gauge<'model_name'>({
    name: 'ollama_running_models',
    help: 'Currently loaded models',
    labelNames: ['model_name'],
    registers: [REGISTRY],
});

export const OLLAMA_MODEL_MEMORY_BYTES = new Gauge<'model_name'>({
    name: 'ollama_model_memory_bytes',
    help: 'Memory used by running model',
    labelNames: ['model_name'],
    registers: [REGISTRY],
});

// Exporter operation metrics
export const OLLAMA_EXPORTER_SCRAPE_DURATION = new Histogram<'operation'>({
    name: 'ollama_exporter_scrape_duration_seconds',
    help: 'Time spent scraping Ollama',
    labelNames: ['operation'],
    registers: [REGISTRY],
});

export const OLLAMA_EXPORTER_SCRAPES_TOTAL = new Counter<'status'>({
    name: 'ollama_exporter_scrapes_total',
    help: 'Total number of scrapes',
    labelNames: ['status'],
    registers: [REGISTRY],
});

export const OLLAMA_EXPORTER_LAST_SCRAPE_TIMESTAMP = new Gauge({
    name: 'ollama_exporter_last_scrape_timestamp_seconds',
    help: 'Last successful scrape timestamp',
    registers: [REGISTRY],
});

// Helper to generate metrics
export async function generateMetrics(): Promise<string> {
    return await REGISTRY.metrics();
}
