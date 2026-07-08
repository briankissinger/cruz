import { BaseEntity, generateUUID } from './base.entity.js';
import type { UUID } from './base.entity.js';

export interface JobEntityProps {
  id: UUID;
  queueName: string;
  jobType: string;
  payload: Record<string, unknown>;
  status: string;
  priority: number;
  attemptsMade: number;
  maxAttempts: number;
  lastError?: string | null;
  failedReason?: string | null;
  processedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  nextAttemptAt?: Date | null;
  scheduledAt?: Date | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  progress: number;
  returnValue?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export class JobEntity extends BaseEntity {
  public readonly queueName: string;
  public readonly jobType: string;
  public payload: Record<string, unknown>;
  public status: string;
  public priority: number;
  public attemptsMade: number;
  public readonly maxAttempts: number;
  public lastError?: string | null;
  public failedReason?: string | null;
  public processedAt?: Date | null;
  public completedAt?: Date | null;
  public failedAt?: Date | null;
  public nextAttemptAt?: Date | null;
  public scheduledAt?: Date | null;
  public startedAt?: Date | null;
  public finishedAt?: Date | null;
  public progress: number;
  public returnValue?: Record<string, unknown> | null;

  constructor(props: JobEntityProps) {
    super(props.id, props.createdAt, props.updatedAt, props.deletedAt);
    this.queueName = props.queueName;
    this.jobType = props.jobType;
    this.payload = props.payload;
    this.status = props.status;
    this.priority = props.priority;
    this.attemptsMade = props.attemptsMade;
    this.maxAttempts = props.maxAttempts;
    this.lastError = props.lastError ?? null;
    this.failedReason = props.failedReason ?? null;
    this.processedAt = props.processedAt ?? null;
    this.completedAt = props.completedAt ?? null;
    this.failedAt = props.failedAt ?? null;
    this.nextAttemptAt = props.nextAttemptAt ?? null;
    this.scheduledAt = props.scheduledAt ?? null;
    this.startedAt = props.startedAt ?? null;
    this.finishedAt = props.finishedAt ?? null;
    this.progress = props.progress;
    this.returnValue = props.returnValue ?? null;
  }

  public static create(props: Omit<JobEntityProps, 'id' | 'createdAt' | 'updatedAt'>): JobEntity {
    return new JobEntity({
      ...props,
      id: generateUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public canRetry(): boolean {
    return this.attemptsMade < this.maxAttempts;
  }
}