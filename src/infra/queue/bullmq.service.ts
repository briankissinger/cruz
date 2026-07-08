import { injectable } from 'inversify';
import { Queue, Worker, Job } from 'bullmq';
import type { ConnectionOptions, JobsOptions } from 'bullmq';
import { getConfig } from '../../config/env.js';
import { logger } from '../../api/middlewares/index.js';

export interface QueueJobData {
  type: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface QueueJobResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

@injectable()
export class QueueService {
  private queues: Map<string, Queue> = new Map();
  private connection: ConnectionOptions;

  constructor() {
    const config = getConfig();
    this.connection = {
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD || undefined,
      db: config.REDIS_DB,
      tls: config.REDIS_TLS ? {} : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  async getQueue(queueName: string): Promise<Queue> {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: this.connection,
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            age: 3600 * 24,
            count: 1000,
          },
          removeOnFail: {
            age: 3600 * 24 * 7,
          },
        },
      });

      await queue.waitUntilReady();
      this.queues.set(queueName, queue);
      logger.info({ queueName }, 'queue initialized');
    }

    return this.queues.get(queueName)!;
  }

  async addJob(
    queueName: string,
    jobType: string,
    payload: Record<string, unknown>,
    options?: JobsOptions,
  ): Promise<QueueJobResult> {
    try {
      const queue = await this.getQueue(queueName);
      const job = await queue.add(jobType, { type: jobType, payload }, options);

      logger.info({ queueName, jobId: job.id, jobType }, 'job added to queue');

      return {
        success: true,
        jobId: job.id,
      };
    } catch (error: any) {
      logger.error({ queueName, jobType, error: error.message }, 'failed to add job to queue');
      return { success: false, error: error.message };
    }
  }

  async getJob(queueName: string, jobId: string): Promise<Job | null> {
    const queue = await this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    return job || null;
  }

  async getQueueMetrics(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = await this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  async removeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.close();
      this.queues.delete(queueName);
    }
  }

  async closeAll(): Promise<void> {
    for (const [name, queue] of this.queues) {
      await queue.close();
      logger.info({ queueName: name }, 'queue closed');
    }
    this.queues.clear();
  }
}

@injectable()
export class WorkerService {
  private workers: Map<string, Worker> = new Map();
  private connection: ConnectionOptions;

  constructor() {
    const config = getConfig();
    this.connection = {
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD || undefined,
      db: config.REDIS_DB,
      tls: config.REDIS_TLS ? {} : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  createWorker(
    queueName: string,
    processor: (job: Job) => Promise<void>,
    concurrency = 5,
  ): Worker {
    if (this.workers.has(queueName)) {
      logger.warn({ queueName }, 'worker already exists for this queue, closing existing one');
      this.workers.get(queueName)!.close();
    }

    const worker = new Worker(queueName, async (job: Job) => {
      logger.info({ queueName, jobId: job.id, jobType: job.name }, 'processing job');
      try {
        await processor(job);
        logger.info({ queueName, jobId: job.id }, 'job completed successfully');
      } catch (error: any) {
        logger.error({ queueName, jobId: job.id, error: error.message }, 'job failed');
        throw error;
      }
    }, {
      connection: this.connection,
      concurrency,
      lockDuration: 30000,
      maxStalledCount: 3,
      stalledInterval: 30000,
    });

    worker.on('completed', (job: Job) => {
      logger.info({ queueName, jobId: job.id }, 'worker completed job');
    });

    worker.on('failed', (job: Job | undefined, error: Error) => {
      logger.error({ queueName, jobId: job?.id, error: error.message }, 'worker failed job');
    });

    worker.on('error', (error: Error) => {
      logger.error({ queueName, error: error.message }, 'worker error');
    });

    this.workers.set(queueName, worker);
    logger.info({ queueName, concurrency }, 'worker created');

    return worker;
  }

  async pauseWorker(queueName: string): Promise<void> {
    const worker = this.workers.get(queueName);
    if (worker) {
      await worker.pause();
      logger.info({ queueName }, 'worker paused');
    }
  }

  async resumeWorker(queueName: string): Promise<void> {
    const worker = this.workers.get(queueName);
    if (worker) {
      await worker.resume();
      logger.info({ queueName }, 'worker resumed');
    }
  }

  async closeWorker(queueName: string): Promise<void> {
    const worker = this.workers.get(queueName);
    if (worker) {
      await worker.close();
      this.workers.delete(queueName);
      logger.info({ queueName }, 'worker closed');
    }
  }

  async closeAll(): Promise<void> {
    for (const [name, worker] of this.workers) {
      await worker.close();
      logger.info({ queueName: name }, 'worker closed');
    }
    this.workers.clear();
  }
}