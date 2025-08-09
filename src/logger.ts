type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

const LOG_LEVELS: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARNING: 2,
    ERROR: 3,
};

class Logger {
    private level: LogLevel = 'INFO';
    private readonly name: string;

    constructor(name: string) {
        this.name = name;
    }

    setLevel(level: LogLevel): void {
        this.level = level;
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
    }

    private format(level: LogLevel, message: string, ...args: unknown[]): string {
        const timestamp = new Date().toISOString();
        const formattedMessage = args.length > 0 ? `${message} ${args.join(' ')}` : message;
        return `${timestamp} - ${this.name} - ${level} - ${formattedMessage}`;
    }

    debug(message: string, ...args: unknown[]): void {
        if (this.shouldLog('DEBUG')) {
            console.debug(this.format('DEBUG', message, ...args));
        }
    }

    info(message: string, ...args: unknown[]): void {
        if (this.shouldLog('INFO')) {
            console.info(this.format('INFO', message, ...args));
        }
    }

    warning(message: string, ...args: unknown[]): void {
        if (this.shouldLog('WARNING')) {
            console.warn(this.format('WARNING', message, ...args));
        }
    }

    error(message: string, ...args: unknown[]): void {
        if (this.shouldLog('ERROR')) {
            console.error(this.format('ERROR', message, ...args));
        }
    }
}

// Create the default logger instance
export const logger = new Logger('ollama-exporter');

// Export function to set log level
export function setLogLevel(level: LogLevel): void {
    logger.setLevel(level);
}
