import { BaseEntity, generateUUID } from './base.entity.js';
import type { UUID } from './base.entity.js';

export interface FailedJobEntityProps {
  id: UUID;
  jobId: UUID;
  queueName: string;
  jobName: string;
  jobData: Record<string, unknown>;
  failureReason: string;
  stackTrace?: string;
  attemptsMade: number;
  maxAttempts: number;
  failedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export class FailedJobEntity extends BaseEntity {
  public readonly jobId: UUID;
  public readonly queueName: string;
  public readonly jobName: string;
  public jobData: Record<string, unknown>;
  public readonly failureReason: string;
  public readonly stackTrace?: string;
  public readonly attemptsMade: number;
  public readonly maxAttempts: number;
  public readonly failedAt: Date;

  constructor(props: FailedJobEntityProps) {
    super(props.id, props.createdAt, props.updatedAt, props.deletedAt);
    this.jobId = props.jobId;
    this.queueName = props.queueName;
    this.jobName = props.jobName;
    this.jobData = props.jobData;
    this.failureReason = props.failureReason;
    this.stackTrace = props.stackTrace;
    this.attemptsMade = props.attemptsMade;
    this.maxAttempts = props.maxAttempts;
    this.failedAt = props.failedAt;
  }

  public static create(props: Omit<FailedJobEntityProps, 'id' | 'createdAt' | 'updatedAt'>): FailedJobEntity {
    return new FailedJobEntity({
      ...props,
      id: generateUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}