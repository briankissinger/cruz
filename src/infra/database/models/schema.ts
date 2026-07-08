import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm/_relations';

export const userStatusEnum = pgEnum('user_status', ['active', 'inactive', 'suspended']);
export const paymentMethodTypeEnum = pgEnum('payment_method_type', ['mpesa', 'pesaflow']);
export const transactionStatusEnum = pgEnum('transaction_status', ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled']);
export const sessionStatusEnum = pgEnum('session_status', ['active', 'revoked', 'expired']);
export const jobStatusEnum = pgEnum('job_status', ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused']);
export const jobTypeEnum = pgEnum('job_type', ['payment-sync', 'webhook-delivery', 'token-cleanup', 'session-cleanup']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_uuid_v7()`),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  status: userStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('users_email_idx').on(table.email),
  index('users_status_idx').on(table.status),
  index('users_deleted_at_idx').on(table.deletedAt),
]);

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().default(sql`gen_uuid_v7()`),
  userId: uuid('user_id').notNull().references(() => users.id),
  clientId: varchar('client_id', { length: 255 }).notNull().unique(),
  clientSecret: varchar('client_secret', { length: 255 }).notNull(),
  apiKey: varchar('api_key', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('customers_user_id_idx').on(table.userId),
  uniqueIndex('customers_client_id_idx').on(table.clientId),
  uniqueIndex('customers_api_key_idx').on(table.apiKey),
  index('customers_deleted_at_idx').on(table.deletedAt),
]);

export const paymentMethods = pgTable('payment_methods', {
  id: uuid('id').primaryKey().default(sql`gen_uuid_v7()`),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: paymentMethodTypeEnum('type').notNull(),
  config: jsonb('config').notNull(),
  testBaseUrl: varchar('test_base_url', { length: 500 }).notNull(),
  productionBaseUrl: varchar('production_base_url', { length: 500 }).notNull(),
  timeoutMs: integer('timeout_ms').notNull().default(30000),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('payment_methods_type_idx').on(table.type),
  index('payment_methods_is_active_idx').on(table.isActive),
  index('payment_methods_deleted_at_idx').on(table.deletedAt),
]);

export const applications = pgTable('applications', {
  id: uuid('id').primaryKey().default(sql`gen_uuid_v7()`),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  paymentMethodId: uuid('payment_method_id').notNull().references(() => paymentMethods.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  config: jsonb('config').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('applications_customer_id_idx').on(table.customerId),
  index('applications_payment_method_id_idx').on(table.paymentMethodId),
  uniqueIndex('applications_customer_payment_method_idx').on(table.customerId, table.paymentMethodId),
  index('applications_is_active_idx').on(table.isActive),
  index('applications_deleted_at_idx').on(table.deletedAt),
]);

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().default(sql`gen_uuid_v7()`),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  invoiceNumber: varchar('invoice_number', { length: 100 }).notNull(),
  merchantRequestId: varchar('merchant_request_id', { length: 255 }).notNull(),
  checkoutRequestId: varchar('checkout_request_id', { length: 255 }).notNull(),
  amount: integer('amount').notNull(),
  paymentMethodId: uuid('payment_method_id').notNull().references(() => paymentMethods.id),
  applicationId: uuid('application_id').notNull().references(() => applications.id),
  status: transactionStatusEnum('status').notNull().default('pending'),
  transactionCode: varchar('transaction_code', { length: 255 }),
  payeeName: varchar('payee_name', { length: 255 }),
  payeeAccount: varchar('payee_account', { length: 255 }),
  paymentDescription: text('payment_description'),
  actualAmount: integer('actual_amount'),
  resultCode: varchar('result_code', { length: 50 }),
  providerResponse: jsonb('provider_response'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('transactions_customer_id_idx').on(table.customerId),
  uniqueIndex('transactions_merchant_request_id_idx').on(table.merchantRequestId),
  uniqueIndex('transactions_checkout_request_id_idx').on(table.checkoutRequestId),
  uniqueIndex('transactions_merchant_checkout_idx').on(table.merchantRequestId, table.checkoutRequestId),
  index('transactions_status_idx').on(table.status),
  index('transactions_payment_method_id_idx').on(table.paymentMethodId),
  index('transactions_deleted_at_idx').on(table.deletedAt),
]);

export const failedTransactions = pgTable('failed_transactions', {
  id: uuid('id').primaryKey().default(sql`gen_uuid_v7()`),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  invoiceNumber: varchar('invoice_number', { length: 100 }).notNull(),
  merchantRequestId: varchar('merchant_request_id', { length: 255 }).notNull(),
  checkoutRequestId: varchar('checkout_request_id', { length: 255 }).notNull(),
  amount: integer('amount').notNull(),
  paymentMethodId: uuid('payment_method_id').notNull().references(() => paymentMethods.id),
  applictionId: uuid('application_id').notNull().references(() => applications.id),
  status: transactionStatusEnum('status').notNull(),
  transactionCode: varchar('transaction_code', { length: 255 }),
  payeeName: varchar('payee_name', { length: 255 }),
  payeeAccount: varchar('payee_account', { length: 255 }),
  paymentDescription: text('payment_description'),
  actualAmount: integer('actual_amount'),
  resultCode: varchar('result_code', { length: 50 }),
  providerResponse: jsonb('provider_response'),
  failureReason: text('failure_reason').notNull(),
  failedAt: timestamp('failed_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('failed_transactions_customer_id_idx').on(table.customerId),
  index('failed_transactions_merchant_request_id_idx').on(table.merchantRequestId),
  index('failed_transactions_deleted_at_idx').on(table.deletedAt),
]);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().default(sql`gen_uuid_v7()`),
  userId: uuid('user_id').notNull().references(() => users.id),
  accessTokenHash: varchar('access_token_hash', { length: 255 }).notNull().unique(),
  refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull().unique(),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }).notNull(),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }).notNull(),
  status: sessionStatusEnum('status').notNull().default('active'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('sessions_user_id_idx').on(table.userId),
  uniqueIndex('sessions_access_token_hash_idx').on(table.accessTokenHash),
  uniqueIndex('sessions_refresh_token_hash_idx').on(table.refreshTokenHash),
  index('sessions_status_idx').on(table.status),
  index('sessions_access_token_expires_at_idx').on(table.accessTokenExpiresAt),
  index('sessions_deleted_at_idx').on(table.deletedAt),
]);

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().default(sql`gen_uuid_v7()`),
  queueName: varchar('queue_name', { length: 255 }).notNull(),
  jobType: jobTypeEnum('job_type').notNull(),
  payload: jsonb('payload').notNull(),
  status: jobStatusEnum('status').notNull().default('waiting'),
  priority: integer('priority').notNull().default(0),
  attemptsMade: integer('attempts_made').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(5),
  lastError: text('last_error'),
  failedReason: text('failed_reason'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  progress: integer('progress').notNull().default(0),
  returnValue: jsonb('return_value'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('jobs_queue_name_idx').on(table.queueName),
  index('jobs_job_type_idx').on(table.jobType),
  index('jobs_status_idx').on(table.status),
  index('jobs_next_attempt_at_idx').on(table.nextAttemptAt),
  index('jobs_scheduled_at_idx').on(table.scheduledAt),
  index('jobs_deleted_at_idx').on(table.deletedAt),
]);

export const failedJobs = pgTable('failed_jobs', {
  id: uuid('id').primaryKey().default(sql`gen_uuid_v7()`),
  jobId: uuid('job_id').notNull().references(() => jobs.id),
  queueName: varchar('queue_name', { length: 255 }).notNull(),
  jobName: varchar('job_name', { length: 255 }).notNull(),
  jobData: jsonb('job_data').notNull(),
  failureReason: text('failure_reason').notNull(),
  stackTrace: text('stack_trace'),
  attemptsMade: integer('attempts_made').notNull(),
  maxAttempts: integer('max_attempts').notNull(),
  failedAt: timestamp('failed_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('failed_jobs_job_id_idx').on(table.jobId),
  index('failed_jobs_queue_name_idx').on(table.queueName),
  index('failed_jobs_failed_at_idx').on(table.failedAt),
  index('failed_jobs_deleted_at_idx').on(table.deletedAt),
]);

export const usersRelations = relations(users, ({ one, many }) => ({
  customer: one(customers, { fields: [users.id], references: [customers.userId] }),
  sessions: many(sessions),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  user: one(users, { fields: [customers.userId], references: [users.id] }),
  applications: many(applications),
  transactions: many(transactions),
  failedTransactions: many(failedTransactions),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ many }) => ({
  applications: many(applications),
  transactions: many(transactions),
  failedTransactions: many(failedTransactions),
}));

export const applicationsRelations = relations(applications, ({ one }) => ({
  customer: one(customers, { fields: [applications.customerId], references: [customers.id] }),
  paymentMethod: one(paymentMethods, { fields: [applications.paymentMethodId], references: [paymentMethods.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  customer: one(customers, { fields: [transactions.customerId], references: [customers.id] }),
  application: one(applications, { fields: [transactions.applicationId], references: [applications.id] }),
  paymentMethod: one(paymentMethods, { fields: [transactions.paymentMethodId], references: [paymentMethods.id] }),
}));

export const failedTransactionsRelations = relations(failedTransactions, ({ one }) => ({
  customer: one(customers, { fields: [failedTransactions.customerId], references: [customers.id] }),
  application: one(applications, { fields: [failedTransactions.applicationId], references: [applications.id] }),
  paymentMethod: one(paymentMethods, { fields: [failedTransactions.paymentMethodId], references: [paymentMethods.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
  failedJob: one(failedJobs, { fields: [jobs.id], references: [failedJobs.jobId] }),
}));

export const failedJobsRelations = relations(failedJobs, ({ one }) => ({
  job: one(jobs, { fields: [failedJobs.jobId], references: [jobs.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type FailedTransaction = typeof failedTransactions.$inferSelect;
export type NewFailedTransaction = typeof failedTransactions.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type FailedJob = typeof failedJobs.$inferSelect;
export type NewFailedJob = typeof failedJobs.$inferInsert;
