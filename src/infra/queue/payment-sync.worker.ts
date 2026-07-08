import { inject, injectable } from 'inversify';
import { Job } from 'bullmq';
import { TYPES } from '../../infra/config/inversify.config.js';
import { QueueService, WorkerService } from './bullmq.service.js';
import { WebhookService } from '../../app/services/webhook.service.js';
import type { WebhookForwardPayload } from '../../app/services/transaction.service.js';
import { WebhookController } from '../../api/controllers/webhook.controller.js';
import { logger } from '../../api/middlewares/index.js';
import { APP_CONSTANTS } from '../../config/constants.js';
import { getConfig } from '../../config/env.js';

export const PAYMENT_SYNC_QUEUE = 'payment-sync';

export interface PaymentSyncJobData {
  transactionId: string;
  customerId: string;
  status: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  transactionCode?: string;
  actualAmount?: number;
  resultCode?: string;
  timestamp: string;
}

@injectable()
export class PaymentSyncWorker {
  constructor(
    @inject(TYPES.QueueService) private queueService: QueueService,
    @inject(TYPES.WorkerService) private workerService: WorkerService,
    @inject(TYPES.WebhookService) private webhookService: WebhookService,
  ) {}

  async start(): Promise<void> {
    this.workerService.createWorker(
      PAYMENT_SYNC_QUEUE,
      async (job: Job) => {
        await this.processPaymentSync(job);
      },
      5,
    );

    logger.info({ queue: PAYMENT_SYNC_QUEUE }, 'payment sync worker started');
  }

  async enqueuePaymentSync(payload: PaymentSyncJobData): Promise<void> {
    const result = await this.queueService.addJob(
      PAYMENT_SYNC_QUEUE,
      'payment-sync',
      payload as any,
      {
        attempts: APP_CONSTANTS.PAYMENT_SYNC_JOB_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: APP_CONSTANTS.PAYMENT_SYNC_JOB_BACKOFF,
        },
      },
    );

    if (result.success) {
      logger.info({ jobId: result.jobId, transactionId: payload.transactionId, customerId: payload.customerId }, 'payment sync job enqueued');
    } else {
      logger.error({ error: result.error, transactionId: payload.transactionId }, 'failed to enqueue payment sync job');
    }
  }

  private async processPaymentSync(job: Job): Promise<void> {
    const data = job.data.payload as PaymentSyncJobData;
    logger.info({ jobId: job.id, transactionId: data.transactionId, attempt: job.attemptsMade }, 'processing payment sync job');

    const tenantWebhooks = WebhookController.getTenantWebhooks(data.customerId);

    if (tenantWebhooks.length === 0) {
      logger.warn({ customerId: data.customerId, transactionId: data.transactionId }, 'no webhooks registered for customer');
      return;
    }

    const webhookPayload: WebhookForwardPayload = {
      transactionId: data.transactionId,
      customerId: data.customerId,
      status: data.status,
      merchantRequestId: data.merchantRequestId,
      checkoutRequestId: data.checkoutRequestId,
      transactionCode: data.transactionCode,
      actualAmount: data.actualAmount,
      resultCode: data.resultCode,
      timestamp: data.timestamp,
    };

    const results = await Promise.allSettled(
      tenantWebhooks.map(async (webhook) => {
        if (!webhook.isActive) return;
        return this.webhookService.deliverWebhook(
          webhook.webhookUrl,
          webhook.secret,
          webhookPayload,
        );
      }),
    );

    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      logger.error({
        transactionId: data.transactionId,
        failures: failures.length,
        total: tenantWebhooks.length,
      }, 'some webhook deliveries failed');
    }

    logger.info({
      jobId: job.id,
      transactionId: data.transactionId,
      deliveries: results.length,
      failures: failures.length,
    }, 'payment sync job completed');
  }

  async stop(): Promise<void> {
    await this.workerService.closeWorker(PAYMENT_SYNC_QUEUE);
    logger.info({ queue: PAYMENT_SYNC_QUEUE }, 'payment sync worker stopped');
  }
}