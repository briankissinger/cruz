import { injectable } from 'inversify';
import { eq, and, isNull, count, desc, lt, asc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { jobs } from '../models/schema.js';
import { getDb } from '../connection.js';
import { BaseDrizzleRepository } from './base.repository.js';
import type { UUID } from '../../../core/domain/base.entity.js';
import { JobEntity } from '../../../core/domain/job.entity.js';
import type { IJobRepository, PaginatedResult, PaginationParams } from '../../../core/interfaces/repository/index.js';
import type { Job, NewJob } from '../models/schema.js';

function mapDbToEntity(dbJob: Job): JobEntity {
  return new JobEntity({
    id: dbJob.id as UUID,
    queueName: dbJob.queueName,
    jobType: dbJob.jobType as any,
    payload: dbJob.payload as Record<string, unknown>,
    status: dbJob.status as any,
    priority: dbJob.priority,
    attemptsMade: dbJob.attemptsMade,
    maxAttempts: dbJob.maxAttempts,
    lastError: dbJob.lastError ?? undefined,
    failedReason: dbJob.failedReason ?? undefined,
    processedAt: dbJob.processedAt ?? undefined,
    completedAt: dbJob.completedAt ?? undefined,
    failedAt: dbJob.failedAt ?? undefined,
    nextAttemptAt: dbJob.nextAttemptAt ?? undefined,
    scheduledAt: dbJob.scheduledAt ?? undefined,
    startedAt: dbJob.startedAt ?? undefined,
    finishedAt: dbJob.finishedAt ?? undefined,
    progress: dbJob.progress,
    returnValue: dbJob.returnValue as Record<string, unknown> | undefined,
    createdAt: dbJob.createdAt,
    updatedAt: dbJob.updatedAt,
    deletedAt: dbJob.deletedAt ?? undefined,
  });
}

function mapEntityToDb(entity: JobEntity): NewJob {
  return {
    id: entity.id,
    queueName: entity.queueName,
    jobType: entity.jobType as any,
    payload: entity.payload as any,
    status: entity.status as any,
    priority: entity.priority,
    attemptsMade: entity.attemptsMade,
    maxAttempts: entity.maxAttempts,
    lastError: entity.lastError ?? null,
    failedReason: entity.failedReason ?? null,
    processedAt: entity.processedAt ?? null,
    completedAt: entity.completedAt ?? null,
    failedAt: entity.failedAt ?? null,
    nextAttemptAt: entity.nextAttemptAt ?? null,
    scheduledAt: entity.scheduledAt ?? null,
    startedAt: entity.startedAt ?? null,
    finishedAt: entity.finishedAt ?? null,
    progress: entity.progress,
    returnValue: entity.returnValue as any ?? null,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt ?? null,
  };
}

@injectable()
export class DrizzleJobRepository extends BaseDrizzleRepository implements IJobRepository {
  protected table = jobs;

  constructor() {
    super();
  }

  async findById(id: UUID): Promise<JobEntity | null> {
    const result = await super.findById(id) as Job | null;
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findAll(pagination?: PaginationParams): Promise<PaginatedResult<JobEntity>> {
    const result = await super.findAll(pagination) as PaginatedResult<Job>;
    return { ...result, data: result.data.map(mapDbToEntity) };
  }

  async findByQueueName(queueName: string, pagination?: PaginationParams): Promise<PaginatedResult<JobEntity>> {
    const result = await this.paginateWhere([eq(jobs.queueName, queueName)], pagination) as PaginatedResult<Job>;
    return { ...result, data: result.data.map(mapDbToEntity) };
  }

  async findByStatus(status: string, pagination?: PaginationParams): Promise<PaginatedResult<JobEntity>> {
    const result = await this.paginateWhere([eq(jobs.status, status as any)], pagination) as PaginatedResult<Job>;
    return { ...result, data: result.data.map(mapDbToEntity) };
  }

  async findWaitingJobs(queueName: string, limit: number): Promise<JobEntity[]> {
    const results = await this.db.select().from(jobs)
      .where(and(eq(jobs.queueName, queueName), eq(jobs.status, 'waiting' as any), isNull(jobs.deletedAt)))
      .orderBy(asc(jobs.priority), asc(jobs.createdAt))
      .limit(limit) as Job[];
    return results.map(mapDbToEntity);
  }

  async findStalledJobs(queueName: string, stalledThresholdMs: number): Promise<JobEntity[]> {
    const threshold = new Date(Date.now() - stalledThresholdMs);
    const results = await this.db.select().from(jobs)
      .where(and(eq(jobs.queueName, queueName), eq(jobs.status, 'active'), lt(jobs.processedAt, threshold), isNull(jobs.deletedAt))) as Job[];
    return results.map(mapDbToEntity);
  }

  async create(entity: JobEntity): Promise<JobEntity> {
    const dbJob = mapEntityToDb(entity);
    await this.db.insert(jobs).values(dbJob);
    return entity;
  }

  async update(entity: JobEntity): Promise<JobEntity> {
    const dbJob = mapEntityToDb(entity);
    await this.db.update(jobs).set(dbJob).where(eq(jobs.id, dbJob.id!));
    return entity;
  }

  async delete(id: UUID): Promise<boolean> {
    return super.delete(id);
  }

  async softDelete(id: UUID): Promise<boolean> {
    return super.softDelete(id);
  }

  async restore(id: UUID): Promise<boolean> {
    return super.restore(id);
  }
}
