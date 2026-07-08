import { injectable } from 'inversify';
import prometheus from 'prom-client';
import type { Request, Response, NextFunction } from 'express';
import { getConfig } from '../../config/env.js';
import { logger } from '../../api/middlewares/index.js';

@injectable()
export class MetricsService {
  private register: prometheus.Registry;
  private httpRequestDuration: prometheus.Histogram<string>;
  private httpRequestTotal: prometheus.Counter<string>;
  private httpRequestSize: prometheus.Summary<string>;
  private httpResponseSize: prometheus.Summary<string>;
  private activeRequests: prometheus.Gauge<string>;
  private paymentTransactionsTotal: prometheus.Counter<string>;
  private paymentTransactionDuration: prometheus.Histogram<string>;
  private paymentTransactionStatus: prometheus.Counter<string>;
  private queueJobsTotal: prometheus.Counter<string>;
  private queueJobsDuration: prometheus.Histogram<string>;
  private databaseQueryDuration: prometheus.Histogram<string>;
  private webhookDeliveryDuration: prometheus.Histogram<string>;
  private webhookDeliveryStatus: prometheus.Counter<string>;

  constructor() {
    this.register = new prometheus.Registry();
    prometheus.collectDefaultMetrics({ register: this.register });

    this.httpRequestDuration = new prometheus.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    this.httpRequestTotal = new prometheus.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    this.httpRequestSize = new prometheus.Summary({
      name: 'http_request_size_bytes',
      help: 'HTTP request size in bytes',
      labelNames: ['method', 'route'],
      registers: [this.register],
    });

    this.httpResponseSize = new prometheus.Summary({
      name: 'http_response_size_bytes',
      help: 'HTTP response size in bytes',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    this.activeRequests = new prometheus.Gauge({
      name: 'http_active_requests',
      help: 'Number of active HTTP requests',
      registers: [this.register],
    });

    this.paymentTransactionsTotal = new prometheus.Counter({
      name: 'payment_transactions_total',
      help: 'Total number of payment transactions',
      labelNames: ['status', 'payment_method'],
      registers: [this.register],
    });

    this.paymentTransactionDuration = new prometheus.Histogram({
      name: 'payment_transaction_duration_seconds',
      help: 'Duration of payment transactions',
      labelNames: ['status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.register],
    });

    this.paymentTransactionStatus = new prometheus.Counter({
      name: 'payment_transaction_status_total',
      help: 'Payment transaction status counts',
      labelNames: ['status'],
      registers: [this.register],
    });

    this.queueJobsTotal = new prometheus.Counter({
      name: 'queue_jobs_total',
      help: 'Total number of queue jobs',
      labelNames: ['queue', 'status'],
      registers: [this.register],
    });

    this.queueJobsDuration = new prometheus.Histogram({
      name: 'queue_job_duration_seconds',
      help: 'Duration of queue job processing',
      labelNames: ['queue', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.register],
    });

    this.databaseQueryDuration = new prometheus.Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.register],
    });

    this.webhookDeliveryDuration = new prometheus.Histogram({
      name: 'webhook_delivery_duration_seconds',
      help: 'Duration of webhook delivery',
      labelNames: ['status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    this.webhookDeliveryStatus = new prometheus.Counter({
      name: 'webhook_delivery_total',
      help: 'Total number of webhook deliveries',
      labelNames: ['status'],
      registers: [this.register],
    });

    logger.info('metrics service initialized');
  }

  middleware(request: Request, response: Response, next: NextFunction): void {
    const end = this.httpRequestDuration.startTimer({
      method: request.method,
      route: request.route?.path || request.path,
    });

    this.activeRequests.inc();

    const requestSize = parseInt(request.headers['content-length'] || '0');
    this.httpRequestSize.observe({ method: request.method, route: request.route?.path || request.path }, requestSize);

    response.on('finish', () => {
      const duration = end({ status_code: response.statusCode.toString() });
      this.httpRequestTotal.inc({
        method: request.method,
        route: request.route?.path || request.path,
        status_code: response.statusCode.toString(),
      });

      const responseSize = parseInt(response.getHeader('content-length') as string || '0');
      this.httpResponseSize.observe(
        { method: request.method, route: request.route?.path || request.path, status_code: response.statusCode.toString() },
        responseSize,
      );

      this.activeRequests.dec();
    });

    next();
  }

  observeDatabaseQuery(operation: string, table: string, duration: number): void {
    this.databaseQueryDuration.observe({ operation, table }, duration);
  }

  recordPaymentTransaction(status: string, paymentMethod: string, duration: number): void {
    this.paymentTransactionsTotal.inc({ status, payment_method: paymentMethod });
    this.paymentTransactionDuration.observe({ status }, duration);
    this.paymentTransactionStatus.inc({ status });
  }

  recordQueueJob(queue: string, status: string, duration: number): void {
    this.queueJobsTotal.inc({ queue, status });
    this.queueJobsDuration.observe({ queue, status }, duration);
  }

  recordWebhookDelivery(status: string, duration: number): void {
    this.webhookDeliveryStatus.inc({ status });
    this.webhookDeliveryDuration.observe({ status }, duration);
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  async getContentType(): Promise<string> {
    return this.register.contentType;
  }
}