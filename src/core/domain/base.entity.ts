import { uuidv7 } from 'uuidv7';

export type UUID = string;

export function generateUUID(): UUID {
  return uuidv7();
}

export interface DomainEntity {
  id: UUID;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export abstract class BaseEntity implements DomainEntity {
  public readonly id: UUID;
  public readonly createdAt: Date;
  public updatedAt: Date;
  public deletedAt?: Date;

  constructor(id: UUID, createdAt?: Date, updatedAt?: Date, deletedAt?: Date) {
    this.id = id;
    this.createdAt = createdAt ?? new Date();
    this.updatedAt = updatedAt ?? new Date();
    this.deletedAt = deletedAt;
  }

  public get isDeleted(): boolean {
    return this.deletedAt !== undefined;
  }

  public markAsDeleted(): void {
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }

  public restore(): void {
    this.deletedAt = undefined;
    this.updatedAt = new Date();
  }
}