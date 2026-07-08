import { BaseEntity, generateUUID } from './base.entity.js';
import type { UUID } from './base.entity.js';
import type { ProviderConfig, MpesaConfig, PesaFlowConfig, PaymentMethodConfig } from './payment-method.entity.js';
export type { MpesaConfig, PesaFlowConfig, PaymentMethodConfig };

export interface ApplicationEntityProps {
  id: UUID;
  customerId: UUID;
  paymentMethodId: UUID;
  name: string;
  description: string;
  config: ProviderConfig;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export class ApplicationEntity extends BaseEntity {
  public readonly customerId: UUID;
  public readonly paymentMethodId: UUID;
  public name: string;
  public description: string;
  public config: ProviderConfig;
  public isActive: boolean;

  constructor(props: ApplicationEntityProps) {
    super(props.id, props.createdAt, props.updatedAt, props.deletedAt);
    this.customerId = props.customerId;
    this.paymentMethodId = props.paymentMethodId;
    this.name = props.name;
    this.description = props.description;
    this.config = props.config;
    this.isActive = props.isActive ?? true;
  }

  public static create(props: Omit<ApplicationEntityProps, 'id' | 'createdAt' | 'updatedAt'>): ApplicationEntity {
    return new ApplicationEntity({
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

  public updateDescription(description: string): void {
    this.description = description;
    this.updatedAt = new Date();
  }

  public updateConfig(config: ProviderConfig): void {
    this.config = config;
    this.updatedAt = new Date();
  }

  public activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  public deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  public toPublicObject(): Omit<ApplicationEntityProps, 'config'> & { configType: string } {
    return {
      id: this.id,
      customerId: this.customerId,
      paymentMethodId: this.paymentMethodId,
      name: this.name,
      description: this.description,
      configType: 'unknown',
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}