import 'reflect-metadata';
import { buildApp } from './app.js';
import { getConfig } from './config/env.js';
import { closePool } from './infra/database/connection.js';
import { logger } from './api/middlewares/index.js';

async function bootstrap(): Promise<void> {
  try {
    const config = getConfig();
    logger.info({ env: config.NODE_ENV, port: config.PORT }, 'starting server');

    const app = await buildApp();

    const server = app.listen(config.PORT, config.HOST, () => {
      logger.info({
        host: config.HOST,
        port: config.PORT,
        env: config.NODE_ENV,
      }, `server listening on ${config.HOST}:${config.PORT}`);
    });

    const gracefulShutdown = async (signal: string) => {
      logger.info({ signal }, 'shutdown signal received');

      server.close(async () => {
        logger.info('HTTP server closed');

        await closePool();
        logger.info('database pool closed');

        process.exit(0);
      });

      setTimeout(() => {
        logger.error('forced shutdown after timeout');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason: Error | any) => {
      logger.error({ error: reason.message, stack: reason.stack }, 'unhandled rejection');
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error({ error: error.message, stack: error.stack }, 'uncaught exception');
      process.exit(1);
    });
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'failed to start server');
    await closePool();
    process.exit(1);
  }
}

bootstrap();