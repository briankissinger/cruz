import type { UUID } from '../../domain/base.entity.js';
import { UserEntity, UserStatusEnum } from '../../domain/user.entity.js';
import { CustomerEntity } from '../../domain/customer.entity.js';
import { ApplicationEntity } from '../../domain/application.entity.js';
import { PaymentMethodEntity, PaymentMethodTypeEnum } from '../../domain/payment-method.entity.js';
import { TransactionEntity, TransactionStatusEnum } from '../../domain/transaction.entity.js';
import { FailedTransactionEntity } from '../../domain/failed-transaction.entity.js';
import { SessionEntity, SessionStatusEnum } from '../../domain/session.entity.js';
import { JobEntity } from '../../domain/job.entity.js';
import { FailedJobEntity } from '../../domain/failed-job.entity.js';

export type PaginationStrategy = 'keyset' | 'offset' | 'ntile' | 'bucket';

export interface SortField {
  column: string;
  direction: 'asc' | 'desc';
}

export interface PaginationParams {
  strategy?: PaginationStrategy;
  page?: number;
  limit?: number;
  after?: string;
  before?: string;
  withTotal?: boolean;
  orderBy?: SortField[];
  totalPages?: number;
  numBuckets?: number;
  bucketColumn?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  nextCursor?: string;
  prevCursor?: string;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface IRepository<T> {
  findById(id: UUID): Promise<T | null>;
  findAll(pagination?: PaginationParams): Promise<PaginatedResult<T>>;
  create(entity: T): Promise<T>;
  update(entity: T): Promise<T>;
  delete(id: UUID): Promise<boolean>;
  softDelete(id: UUID): Promise<boolean>;
  restore(id: UUID): Promise<boolean>;
}

export interface IUserRepository extends IRepository<UserEntity> {
  findByEmail(email: string): Promise<UserEntity | null>;
  findByStatus(status: UserStatusEnum, pagination?: PaginationParams): Promise<PaginatedResult<UserEntity>>;
  existsByEmail(email: string): Promise<boolean>;
}

export interface ICustomerRepository extends IRepository<CustomerEntity> {
  findByUserId(userId: UUID): Promise<CustomerEntity | null>;
  findByClientId(clientId: string): Promise<CustomerEntity | null>;
  findByApiKey(apiKey: string): Promise<CustomerEntity | null>;
  findByApiKeyHash(apiKeyHash: string): Promise<CustomerEntity | null>;
  getWithApplications(customerId: UUID): Promise<CustomerEntity | null>;
}

export interface IApplicationRepository extends IRepository<ApplicationEntity> {
  findByCustomerId(customerId: UUID, pagination?: PaginationParams): Promise<PaginatedResult<ApplicationEntity>>;
  findByPaymentMethodId(paymentMethodId: UUID): Promise<ApplicationEntity[]>;
  findByCustomerAndPaymentMethod(customerId: UUID, paymentMethodId: UUID): Promise<ApplicationEntity | null>;
  getWithPaymentMethod(applicationId: UUID): Promise<ApplicationEntity | null>;
}

export interface IPaymentMethodRepository extends IRepository<PaymentMethodEntity> {
  findByType(type: PaymentMethodTypeEnum): Promise<PaymentMethodEntity[]>;
  findActiveByType(type: PaymentMethodTypeEnum): Promise<PaymentMethodEntity[]>;
}

export interface ITransactionRepository extends IRepository<TransactionEntity> {
  findByCustomerId(customerId: UUID, pagination?: PaginationParams): Promise<PaginatedResult<TransactionEntity>>;
  findByMerchantRequestId(merchantRequestId: string): Promise<TransactionEntity | null>;
  findByCheckoutRequestId(checkoutRequestId: string): Promise<TransactionEntity | null>;
  findByMerchantAndCheckoutIds(merchantRequestId: string, checkoutRequestId: string): Promise<TransactionEntity | null>;
  findByStatus(status: TransactionStatusEnum, pagination?: PaginationParams): Promise<PaginatedResult<TransactionEntity>>;
  findPendingByCustomerId(customerId: UUID): Promise<TransactionEntity[]>;
  getWithCustomer(transactionId: UUID): Promise<TransactionEntity | null>;
  getWithPaymentMethod(transactionId: UUID): Promise<TransactionEntity | null>;
}

export interface IFailedTransactionRepository extends IRepository<FailedTransactionEntity> {
  findByCustomerId(customerId: UUID, pagination?: PaginationParams): Promise<PaginatedResult<FailedTransactionEntity>>;
  findByOriginalTransactionId(transactionId: UUID): Promise<FailedTransactionEntity | null>;
}

export interface ISessionRepository extends IRepository<SessionEntity> {
  findByUserId(userId: UUID, pagination?: PaginationParams): Promise<PaginatedResult<SessionEntity>>;
  findByAccessTokenHash(accessTokenHash: string): Promise<SessionEntity | null>;
  findByRefreshTokenHash(refreshTokenHash: string): Promise<SessionEntity | null>;
  findActiveByUserId(userId: UUID): Promise<SessionEntity[]>;
  revokeAllByUserId(userId: UUID): Promise<number>;
  blacklistByAccessTokenHash(accessTokenHash: string): Promise<boolean>;
  cleanupExpired(): Promise<number>;
}

export interface IJobRepository extends IRepository<JobEntity> {
  findByQueueName(queueName: string, pagination?: PaginationParams): Promise<PaginatedResult<JobEntity>>;
  findByStatus(status: string, pagination?: PaginationParams): Promise<PaginatedResult<JobEntity>>;
  findWaitingJobs(queueName: string, limit: number): Promise<JobEntity[]>;
  findStalledJobs(queueName: string, stalledThresholdMs: number): Promise<JobEntity[]>;
}

export interface IFailedJobRepository extends IRepository<FailedJobEntity> {
  findByQueueName(queueName: string, pagination?: PaginationParams): Promise<PaginatedResult<FailedJobEntity>>;
  findByJobId(jobId: UUID): Promise<FailedJobEntity | null>;
  retry(failedJobId: UUID): Promise<FailedJobEntity | null>;
}
