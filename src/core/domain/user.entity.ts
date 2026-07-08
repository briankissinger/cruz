import { BaseEntity, generateUUID } from './base.entity.js';
import type { UUID } from './base.entity.js';

export enum UserStatusEnum {
  ACTIVE = 0,
  INACTIVE = 1,
  SUSPENDED = 2,
}

export type UserStatusValue = 'active' | 'inactive' | 'suspended';

export const UserStatus: Record<UserStatusEnum, UserStatusValue> = {
  [UserStatusEnum.ACTIVE]: 'active',
  [UserStatusEnum.INACTIVE]: 'inactive',
  [UserStatusEnum.SUSPENDED]: 'suspended',
};

export interface UserEntityProps {
  id: UUID;
  name: string;
  email: string;
  passwordHash: string;
  status: UserStatusEnum;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export class UserEntity extends BaseEntity {
  public name: string;
  public email: string;
  public passwordHash: string;
  public status: UserStatusEnum;

  constructor(props: UserEntityProps) {
    super(props.id, props.createdAt, props.updatedAt, props.deletedAt);
    this.name = props.name;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.status = props.status;
  }

  public static create(props: Omit<UserEntityProps, 'id' | 'createdAt' | 'updatedAt'>): UserEntity {
    return new UserEntity({
      ...props,
      id: generateUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public updateName(name: string): void {
    this.name = name;
    this.updatedAt = new Date();
  }

  public updateEmail(email: string): void {
    this.email = email;
    this.updatedAt = new Date();
  }

  public updatePassword(passwordHash: string): void {
    this.passwordHash = passwordHash;
    this.updatedAt = new Date();
  }

  public activate(): void {
    this.status = UserStatusEnum.ACTIVE;
    this.updatedAt = new Date();
  }

  public deactivate(): void {
    this.status = UserStatusEnum.INACTIVE;
    this.updatedAt = new Date();
  }

  public suspend(): void {
    this.status = UserStatusEnum.SUSPENDED;
    this.updatedAt = new Date();
  }

  public getStatusLabel(): UserStatusValue {
    return UserStatus[this.status];
  }

  public isActive(): boolean {
    return this.status === UserStatusEnum.ACTIVE && !this.isDeleted;
  }

  public toPublicObject(): Omit<UserEntityProps, 'passwordHash'> & { statusLabel: UserStatusValue } {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      status: this.status,
      statusLabel: this.getStatusLabel(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}