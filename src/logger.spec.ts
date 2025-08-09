import { describe, it, expect } from 'vitest';
import { logger } from './logger.ts';

describe('Logger', () => {
    it('should exist', () => {
        expect(logger).toBeDefined();
    });

    it('should have logging methods', () => {
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.warning).toBe('function');
        expect(typeof logger.debug).toBe('function');
    });
});
