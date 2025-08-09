#!/usr/bin/env node
import { createServer } from 'node:http';
import { URL } from 'node:url';
import { program } from '@commander-js/extra-typings';
import { OllamaExporter } from './exporter.ts';
import { FetchHttpClient } from './http-client.ts';
import { logger, setLogLevel } from './logger.ts';
import { REGISTRY, generateMetrics } from './metrics.ts';

export const VERSION = '1.0.0';

interface ProgramOptions {
    port: string;
    interval: string;
    ollamaHost: string;
    apiTimeout: string;
    logLevel: string;
    validateConfig: boolean;
}

function getConfig(): {
    port: number;
    interval: number;
    apiTimeout: number;
    logLevel: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
    ollamaHost: string;
    validateConfig: boolean;
} {
    // Environment variable defaults
    const envDefaults = {
        port: process.env.PORT || '8000',
        interval: process.env.INTERVAL || '30',
        ollamaHost: process.env.OLLAMA_HOST || 'localhost:11434',
        apiTimeout: process.env.API_TIMEOUT || '30',
        logLevel: process.env.LOG_LEVEL || 'INFO',
    };

    program
        .name('ollama-exporter')
        .description('Prometheus exporter for Ollama metrics')
        .version(VERSION)
        .option('-p, --port <port>', 'Port to serve metrics on', envDefaults.port)
        .option('-i, --interval <interval>', 'Scrape interval in seconds', envDefaults.interval)
        .option('--ollama-host <host>', 'Ollama server host:port', envDefaults.ollamaHost)
        .option('-t, --api-timeout <timeout>', 'Timeout for Ollama API calls in seconds', envDefaults.apiTimeout)
        .option('-l, --log-level <level>', 'Log level', envDefaults.logLevel)
        .option('--validate-config', 'Validate configuration and exit', false)
        .parse();

    const options = program.opts() as ProgramOptions;

    return {
        port: parseInt(options.port, 10),
        interval: parseInt(options.interval, 10),
        apiTimeout: parseInt(options.apiTimeout, 10),
        logLevel: options.logLevel as 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR',
        ollamaHost: options.ollamaHost,
        validateConfig: options.validateConfig,
    };
}

async function main(): Promise<void> {
    const config = getConfig();

    setLogLevel(config.logLevel);

    if (config.validateConfig) {
        logger.info('Validating configuration...');
        const httpClient = new FetchHttpClient();
        const exporter = new OllamaExporter(config.ollamaHost, config.apiTimeout, httpClient);

        if (await exporter.checkOllamaHealth()) {
            logger.info('✅ Ollama API connection successful');
        } else {
            logger.error('❌ Cannot connect to Ollama API');
            process.exit(1);
        }

        logger.info('✅ Configuration valid');
        return;
    }

    logger.info(`Starting Ollama Prometheus Exporter v${VERSION}`);
    logger.info(`Metrics server: http://localhost:${config.port}/metrics`);
    logger.info(`Health check: http://localhost:${config.port}/health`);
    logger.info(`Ollama API: ${config.ollamaHost}`);
    logger.info(`Scrape interval: ${config.interval}s`);
    logger.info(`API timeout: ${config.apiTimeout}s`);

    const httpClient = new FetchHttpClient();
    const exporter = new OllamaExporter(config.ollamaHost, config.apiTimeout, httpClient);

    // Set up signal handlers
    const shutdown = (): void => {
        logger.info('Shutdown requested');
        exporter.shutdown();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Create HTTP server
    const server = createServer(async (req, res) => {
        const url = new URL(req.url || '/', `http://localhost:${config.port}`);

        if (url.pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            const health = {
                status: exporter.isShuttingDown() ? 'shutting_down' : 'healthy',
                timestamp: new Date().toISOString(),
                ollama_host: config.ollamaHost,
            };
            res.end(JSON.stringify(health));
        } else if (url.pathname === '/metrics') {
            res.writeHead(200, { 'Content-Type': REGISTRY.contentType });
            res.end(await generateMetrics());
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    server.listen(config.port, () => {
        logger.info(`HTTP server started on port ${config.port}`);
    });

    // Perform initial scrape
    logger.info('Performing initial metrics scrape...');
    await exporter.updateMetrics();

    // Start metrics loop
    exporter.startMetricsLoop(config.interval);

    logger.info('Exporter started successfully. Press Ctrl+C to exit.');

    // Keep the process running
    await new Promise<void>((resolve) => {
        exporter.on('shutdown', resolve);
    });
}

// Run main function
main().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
});
