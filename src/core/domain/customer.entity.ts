import { BaseEntity, generateUUID } from './base.entity.js';
import type { UUID } from './base.entity.js';

export interface CustomerEntityProps {
  id: UUID;
  userId: UUID;
  clientId: string;
  clientSecret: string;
  apiKey: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export class CustomerEntity extends BaseEntity {
  public readonly userId: UUID;
  public readonly clientId: string;
  public clientSecret: string;
  public apiKey: string;
  public name: string;

  constructor(props: CustomerEntityProps) {
    super(props.id, props.createdAt, props.updatedAt, props.deletedAt);
    this.userId = props.userId;
    this.clientId = props.clientId;
    this.clientSecret = props.clientSecret;
    this.apiKey = props.apiKey;
    this.name = props.name;
  }

  public static create(props: Omit<CustomerEntityProps, 'id' | 'createdAt' | 'updatedAt'>): CustomerEntity {
    return new CustomerEntity({
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

  public rotateApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    this.updatedAt = new Date();
  }

  public rotateClientSecret(clientSecret: string): void {
    this.clientSecret = clientSecret;
    this.updatedAt = new Date();
  }

  public toPublicObject(): Omit<CustomerEntityProps, 'clientSecret'> {
    return {
      id: this.id,
      userId: this.userId,
      clientId: this.clientId,
      apiKey: this.apiKey,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}