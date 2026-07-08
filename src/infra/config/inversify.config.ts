import { Container, ContainerModule } from 'inversify';
import { getConfig } from '../../config/env.js';

export const TYPES = {
  Config: Symbol.for('Config'),
  Logger: Symbol.for('Logger'),
  DatabaseConnection: Symbol.for('DatabaseConnection'),
  RedisConnection: Symbol.for('RedisConnection'),
  PaginationService: Symbol.for('PaginationService'),

  UserRepository: Symbol.for('UserRepository'),
  CustomerRepository: Symbol.for('CustomerRepository'),
  ApplicationRepository: Symbol.for('ApplicationRepository'),
  PaymentMethodRepository: Symbol.for('PaymentMethodRepository'),
  TransactionRepository: Symbol.for('TransactionRepository'),
  FailedTransactionRepository: Symbol.for('FailedTransactionRepository'),
  SessionRepository: Symbol.for('SessionRepository'),
  JobRepository: Symbol.for('JobRepository'),
  FailedJobRepository: Symbol.for('FailedJobRepository'),

  UserService: Symbol.for('UserService'),
  CustomerService: Symbol.for('CustomerService'),
  ApplicationService: Symbol.for('ApplicationService'),
  PaymentMethodService: Symbol.for('PaymentMethodService'),
  TransactionService: Symbol.for('TransactionService'),
  AuthenticationService: Symbol.for('AuthenticationService'),
  AuthorizationService: Symbol.for('AuthorizationService'),
  PaymentProviderService: Symbol.for('PaymentProviderService'),
  WebhookService: Symbol.for('WebhookService'),
  RateLimitService: Symbol.for('RateLimitService'),
  TokenService: Symbol.for('TokenService'),
  ApiKeyService: Symbol.for('ApiKeyService'),

  UserController: Symbol.for('UserController'),
  CustomerController: Symbol.for('CustomerController'),
  ApplicationController: Symbol.for('ApplicationController'),
  PaymentMethodController: Symbol.for('PaymentMethodController'),
  TransactionController: Symbol.for('TransactionController'),
  AuthenticationController: Symbol.for('AuthenticationController'),
  WebhookController: Symbol.for('WebhookController'),

  PaymentProvider: Symbol.for('PaymentProvider'),
  HttpClient: Symbol.for('HttpClient'),
  QueueService: Symbol.for('QueueService'),
  WorkerService: Symbol.for('WorkerService'),
  PaymentSyncWorker: Symbol.for('PaymentSyncWorker'),

  AuthGuard: Symbol.for('AuthGuard'),
  ApiKeyGuard: Symbol.for('ApiKeyGuard'),
  RateLimitGuard: Symbol.for('RateLimitGuard'),
  PermissionGuard: Symbol.for('PermissionGuard'),

  ValidationPipe: Symbol.for('ValidationPipe'),
  TransformPipe: Symbol.for('TransformPipe'),

  ExceptionFilter: Symbol.for('ExceptionFilter'),
  HttpExceptionFilter: Symbol.for('HttpExceptionFilter'),

  LoggerMiddleware: Symbol.for('LoggerMiddleware'),
  RequestIdMiddleware: Symbol.for('RequestIdMiddleware'),
  CorsMiddleware: Symbol.for('CorsMiddleware'),
  HelmetMiddleware: Symbol.for('HelmetMiddleware'),

  ApiKeyPolicy: Symbol.for('ApiKeyPolicy'),
  TokenPolicy: Symbol.for('TokenPolicy'),
  TenantPolicy: Symbol.for('TenantPolicy'),
} as const;

const configModule = new ContainerModule(({ bind }) => {
  bind<ReturnType<typeof getConfig>>(TYPES.Config).toConstantValue(getConfig());
});

const configContainer = new Container();
configContainer.load(configModule);

export { configContainer };