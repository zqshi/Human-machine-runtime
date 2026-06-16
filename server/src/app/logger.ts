import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.env === 'production' ? 'info' : 'debug',
  ...(config.env === 'production' && {
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  }),
});
