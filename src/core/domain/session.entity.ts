import { BaseEntity, generateUUID } from './base.entity.js';
import type { UUID } from './base.entity.js';

export enum SessionStatusEnum {
  ACTIVE = 0,
  EXPIRED = 1,
  REVOKED = 2,
  BLACKLISTED = 3,
}

export interface SessionEntityProps {
  id: UUID;
  userId: UUID;
  accessTokenHash: string;
  refreshTokenHash: string;
  ipAddress?: string;
  userAgent?: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  status: SessionStatusEnum;
  lastActivityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export class SessionEntity extends BaseEntity {
  public readonly userId: UUID;
  public readonly accessTokenHash: string;
  public readonly refreshTokenHash: string;
  public readonly ipAddress?: string;
  public readonly userAgent?: string;
  public accessTokenExpiresAt: Date;
  public refreshTokenExpiresAt: Date;
  public status: SessionStatusEnum;
  public lastActivityAt: Date;

  constructor(props: SessionEntityProps) {
    super(props.id, props.createdAt, props.updatedAt, props.deletedAt);
    this.userId = props.userId;
    this.accessTokenHash = props.accessTokenHash;
    this.refreshTokenHash = props.refreshTokenHash;
    this.ipAddress = props.ipAddress;
    this.userAgent = props.userAgent;
    this.accessTokenExpiresAt = props.accessTokenExpiresAt;
    this.refreshTokenExpiresAt = props.refreshTokenExpiresAt;
    this.status = props.status;
    this.lastActivityAt = props.lastActivityAt ?? new Date();
  }

  public static create(props: Omit<SessionEntityProps, 'id' | 'createdAt' | 'updatedAt'>): SessionEntity {
    return new SessionEntity({
      ...props,
      id: generateUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public revoke(): void {
    this.status = SessionStatusEnum.REVOKED;
    this.updatedAt = new Date();
  }

  public updateActivity(): void {
    this.lastActivityAt = new Date();
    this.updatedAt = new Date();
  }

  public isActive(): boolean {
    return this.status === SessionStatusEnum.ACTIVE && !this.isExpired();
  }

  public isExpired(): boolean {
    return new Date() > this.accessTokenExpiresAt;
  }

  public isRefreshExpired(): boolean {
    return new Date() > this.refreshTokenExpiresAt;
  }

  public isValid(): boolean {
    return this.isActive();
  }
}
