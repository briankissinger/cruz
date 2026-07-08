import 'reflect-metadata';
import express, { type Application } from 'express';
import { Container } from 'inversify';
import { InversifyExpressHttpAdapter } from '@inversifyjs/http-express';
import swaggerUi from 'swagger-ui-express';
import { TYPES } from './infra/config/inversify.config.js';
import { getConfig } from './config/env.js';
import { logger } from './api/middlewares/index.js';
import { DrizzleUserRepository } from './infra/database/repositories/user.repository.js';
import { PaginationService } from './infra/database/pagination.service.js';
import { DrizzleCustomerRepository } from './infra/database/repositories/customer.repository.js';
import { DrizzlePaymentMethodRepository } from './infra/database/repositories/payment-method.repository.js';
import { DrizzleApplicationRepository } from './infra/database/repositories/application.repository.js';
import { DrizzleTransactionRepository } from './infra/database/repositories/transaction.repository.js';
import { DrizzleFailedTransactionRepository } from './infra/database/repositories/failed-transaction.repository.js';
import { DrizzleSessionRepository } from './infra/database/repositories/session.repository.js';
import { DrizzleJobRepository } from './infra/database/repositories/job.repository.js';
import { DrizzleFailedJobRepository } from './infra/database/repositories/failed-job.repository.js';
import { AuthenticationService, ApiKeyService, RateLimitService, TransactionService, PaymentProviderService, WebhookService, UserService, CustomerService, ApplicationService, PaymentMethodService } from './app/services/index.js';
import { authGuard, apiKeyGuard, rateLimitGuard, permissionGuard } from './api/guards/index.js';
import { validationPipe, transformPipe } from './api/pipes/index.js';
import { exceptionFilter, httpExceptionFilter } from './api/filters/index.js';
import { apiKeyPolicy, tokenPolicy, tenantPolicy } from './api/policies/index.js';
import { LoggerMiddleware, RequestIdMiddleware, CorsMiddleware, HelmetMiddleware } from './api/middlewares/index.js';
import { QueueService, WorkerService, PaymentSyncWorker } from './infra/queue/index.js';
import { AuthenticationController } from './api/controllers/authentication.controller.js';
import { WebhookController } from './api/controllers/webhook.controller.js';
import { TransactionController } from './api/controllers/transaction.controller.js';
import { UserController } from './api/controllers/user.controller.js';
import { CustomerController } from './api/controllers/customer.controller.js';
import { ApplicationController } from './api/controllers/application.controller.js';
import { PaymentMethodController } from './api/controllers/payment-method.controller.js';
import { swaggerSpec } from './infra/swagger/index.js';

export async function buildApp(): Promise<Application> {
  const container = new Container();

  container.bind<ReturnType<typeof getConfig>>(TYPES.Config).toConstantValue(getConfig());
  container.bind<PaginationService>(TYPES.PaginationService).to(PaginationService).inSingletonScope();

  container.bind<AuthenticationService>(TYPES.AuthenticationService).to(AuthenticationService).inSingletonScope();
  container.bind<ApiKeyService>(TYPES.ApiKeyService).to(ApiKeyService).inSingletonScope();
  container.bind<RateLimitService>(TYPES.RateLimitService).to(RateLimitService).inSingletonScope();
  container.bind<TransactionService>(TYPES.TransactionService).to(TransactionService).inSingletonScope();
  container.bind<PaymentProviderService>(TYPES.PaymentProviderService).to(PaymentProviderService).inSingletonScope();
  container.bind<WebhookService>(TYPES.WebhookService).to(WebhookService).inSingletonScope();
  container.bind<UserService>(TYPES.UserService).to(UserService).inSingletonScope();
  container.bind<CustomerService>(TYPES.CustomerService).to(CustomerService).inSingletonScope();
  container.bind<ApplicationService>(TYPES.ApplicationService).to(ApplicationService).inSingletonScope();
  container.bind<PaymentMethodService>(TYPES.PaymentMethodService).to(PaymentMethodService).inSingletonScope();

  container.bind<DrizzleUserRepository>(TYPES.UserRepository).to(DrizzleUserRepository).inSingletonScope();
  container.bind<DrizzleCustomerRepository>(TYPES.CustomerRepository).to(DrizzleCustomerRepository).inSingletonScope();
  container.bind<DrizzlePaymentMethodRepository>(TYPES.PaymentMethodRepository).to(DrizzlePaymentMethodRepository).inSingletonScope();
  container.bind<DrizzleApplicationRepository>(TYPES.ApplicationRepository).to(DrizzleApplicationRepository).inSingletonScope();
  container.bind<DrizzleTransactionRepository>(TYPES.TransactionRepository).to(DrizzleTransactionRepository).inSingletonScope();
  container.bind<DrizzleFailedTransactionRepository>(TYPES.FailedTransactionRepository).to(DrizzleFailedTransactionRepository).inSingletonScope();
  container.bind<DrizzleSessionRepository>(TYPES.SessionRepository).to(DrizzleSessionRepository).inSingletonScope();
  container.bind<DrizzleJobRepository>(TYPES.JobRepository).to(DrizzleJobRepository).inSingletonScope();
  container.bind<DrizzleFailedJobRepository>(TYPES.FailedJobRepository).to(DrizzleFailedJobRepository).inSingletonScope();

  container.bind<authGuard>(TYPES.AuthGuard).to(authGuard).inSingletonScope();
  container.bind<apiKeyGuard>(TYPES.ApiKeyGuard).to(apiKeyGuard).inSingletonScope();
  container.bind<rateLimitGuard>(TYPES.RateLimitGuard).to(rateLimitGuard).inSingletonScope();
  container.bind<permissionGuard>(TYPES.PermissionGuard).to(permissionGuard).inSingletonScope();

  container.bind<validationPipe>(TYPES.ValidationPipe).to(validationPipe).inSingletonScope();
  container.bind<transformPipe>(TYPES.TransformPipe).to(transformPipe).inSingletonScope();

  container.bind<exceptionFilter>(TYPES.ExceptionFilter).to(exceptionFilter).inSingletonScope();
  container.bind<httpExceptionFilter>(TYPES.HttpExceptionFilter).to(httpExceptionFilter).inSingletonScope();

  container.bind<apiKeyPolicy>(TYPES.ApiKeyPolicy).to(apiKeyPolicy).inSingletonScope();
  container.bind<tokenPolicy>(TYPES.TokenPolicy).to(tokenPolicy).inSingletonScope();
  container.bind<tenantPolicy>(TYPES.TenantPolicy).to(tenantPolicy).inSingletonScope();

  container.bind<RequestIdMiddleware>(TYPES.RequestIdMiddleware).to(RequestIdMiddleware).inSingletonScope();
  container.bind<HelmetMiddleware>(TYPES.HelmetMiddleware).to(HelmetMiddleware).inSingletonScope();
  container.bind<CorsMiddleware>(TYPES.CorsMiddleware).to(CorsMiddleware).inSingletonScope();
  container.bind<LoggerMiddleware>(TYPES.LoggerMiddleware).to(LoggerMiddleware).inSingletonScope();

  container.bind<QueueService>(TYPES.QueueService).to(QueueService).inSingletonScope();
  container.bind<WorkerService>(TYPES.WorkerService).to(WorkerService).inSingletonScope();
  container.bind<PaymentSyncWorker>(TYPES.PaymentSyncWorker).to(PaymentSyncWorker).inSingletonScope();

  container.bind(AuthenticationController).toSelf().inSingletonScope();
  container.bind(WebhookController).toSelf().inSingletonScope();
  container.bind(TransactionController).toSelf().inSingletonScope();
  container.bind(UserController).toSelf().inSingletonScope();
  container.bind(CustomerController).toSelf().inSingletonScope();
  container.bind(ApplicationController).toSelf().inSingletonScope();
  container.bind(PaymentMethodController).toSelf().inSingletonScope();

  const adapter = new InversifyExpressHttpAdapter(container, {
    useJson: true,
    useUrlEncoded: true,
  });

  adapter.applyGlobalMiddleware(
    TYPES.RequestIdMiddleware,
    TYPES.CorsMiddleware,
    TYPES.HelmetMiddleware,
    TYPES.LoggerMiddleware,
  );

  const app = await adapter.build();

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/docs.json', (req, res) => res.json(swaggerSpec));

  const paymentSyncWorker = container.get<PaymentSyncWorker>(TYPES.PaymentSyncWorker);
  await paymentSyncWorker.start();
  logger.info('payment sync worker started');

  logger.info('application initialized');
  return app;
}