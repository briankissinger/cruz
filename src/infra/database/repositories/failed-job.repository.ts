import { injectable } from 'inversify';
import { eq, and, isNull, count, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { failedJobs, jobs } from '../models/schema.js';
import { getDb } from '../connection.js';
import { BaseDrizzleRepository } from './base.repository.js';
import type { UUID } from '../../../core/domain/base.entity.js';
import { FailedJobEntity } from '../../../core/domain/failed-job.entity.js';
import type { IFailedJobRepository, PaginatedResult, PaginationParams } from '../../../core/interfaces/repository/index.js';
import type { FailedJob, NewFailedJob } from '../models/schema.js';

function mapDbToEntity(dbFj: FailedJob): FailedJobEntity {
  return new FailedJobEntity({
    id: dbFj.id as UUID,
    jobId: dbFj.jobId as UUID,
    queueName: dbFj.queueName,
    jobName: dbFj.jobName,
    jobData: dbFj.jobData as Record<string, unknown>,
    failureReason: dbFj.failureReason,
    stackTrace: dbFj.stackTrace ?? undefined,
    attemptsMade: dbFj.attemptsMade,
    maxAttempts: dbFj.maxAttempts,
    failedAt: dbFj.failedAt,
    createdAt: dbFj.createdAt,
    updatedAt: dbFj.updatedAt,
    deletedAt: dbFj.deletedAt ?? undefined,
  });
}

function mapEntityToDb(entity: FailedJobEntity): NewFailedJob {
  return {
    id: entity.id,
    jobId: entity.jobId,
    queueName: entity.queueName,
    jobName: entity.jobName,
    jobData: entity.jobData as any,
    failureReason: entity.failureReason,
    stackTrace: entity.stackTrace ?? null,
    attemptsMade: entity.attemptsMade,
    maxAttempts: entity.maxAttempts,
    failedAt: entity.failedAt,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt ?? null,
  };
}

@injectable()
export class DrizzleFailedJobRepository extends BaseDrizzleRepository implements IFailedJobRepository {
  protected table = failedJobs;

  constructor() {
    super();
  }

  async findById(id: UUID): Promise<FailedJobEntity | null> {
    const result = await super.findById(id) as FailedJob | null;
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async findAll(pagination?: PaginationParams): Promise<PaginatedResult<FailedJobEntity>> {
    const result = await super.findAll(pagination) as PaginatedResult<FailedJob>;
    return { ...result, data: result.data.map(mapDbToEntity) };
  }

  async findByQueueName(queueName: string, pagination?: PaginationParams): Promise<PaginatedResult<FailedJobEntity>> {
    const result = await this.paginateWhere([eq(failedJobs.queueName, queueName)], pagination) as PaginatedResult<FailedJob>;
    return { ...result, data: result.data.map(mapDbToEntity) };
  }

  async findByJobId(jobId: UUID): Promise<FailedJobEntity | null> {
    const [result] = await this.db.select().from(failedJobs)
      .where(and(eq(failedJobs.jobId, jobId), isNull(failedJobs.deletedAt)))
      .limit(1) as FailedJob[];
    if (!result) return null;
    return mapDbToEntity(result);
  }

  async retry(failedJobId: UUID): Promise<FailedJobEntity | null> {
    const failedJob = await this.findById(failedJobId);
    if (!failedJob) return null;

    await this.db.update(jobs)
      .set({ status: 'waiting', attemptsMade: 0, updatedAt: new Date() })
      .where(eq(jobs.id, failedJob.jobId!));

    return failedJob;
  }

  async create(entity: FailedJobEntity): Promise<FailedJobEntity> {
    const dbFj = mapEntityToDb(entity) as any;
    await this.db.insert(failedJobs).values(dbFj);
    return entity;
  }

  async update(entity: FailedJobEntity): Promise<FailedJobEntity> {
    const dbFj = mapEntityToDb(entity);
    await this.db.update(failedJobs).set(dbFj).where(eq(failedJobs.id, dbFj.id!));
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
