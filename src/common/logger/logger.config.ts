import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

export function createLoggerConfig(): WinstonModuleOptions {
  const isProduction = process.env.NODE_ENV === 'production';

  const devFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf((info) => {
      const ts = typeof info.timestamp === 'string' ? info.timestamp : '';
      const ctx = typeof info.context === 'string' ? `[${info.context}]` : '';
      const body =
        typeof info.stack === 'string' ? info.stack : String(info.message);
      return `${ts} ${ctx} ${info.level}: ${body}`;
    }),
  );

  const prodFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  return {
    transports: [
      new winston.transports.Console({
        level: isProduction ? 'info' : 'debug',
        format: isProduction ? prodFormat : devFormat,
      }),
    ],
  };
}
