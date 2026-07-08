import { BaseEntity, generateUUID } from './base.entity.js';
import type { UUID } from './base.entity.js';

export enum PaymentMethodTypeEnum {
  MPESA = 0,
  PESAFLOW = 1,
}

export const PaymentMethodType: Record<PaymentMethodTypeEnum, string> = {
  [PaymentMethodTypeEnum.MPESA]: 'M-PESA',
  [PaymentMethodTypeEnum.PESAFLOW]: 'PesaFlow',
};

export interface MpesaConfig {
  consumerKey: string;
  consumerSecret: string;
  passKey: string;
  shortCode: string;
}

export interface PesaFlowConfig {
  apiKey: string;
  apiSecret: string;
  apiClientId: string;
}

export type ProviderConfig = MpesaConfig | PesaFlowConfig;

export type PaymentMethodConfig = ProviderConfig;

export interface PaymentMethodEntityProps {
  id: UUID;
  name: string;
  description: string;
  type: PaymentMethodTypeEnum;
  config: ProviderConfig;
  testBaseUrl: string;
  productionBaseUrl: string;
  timeoutMs?: number;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export class PaymentMethodEntity extends BaseEntity {
  public readonly name: string;
  public description: string;
  public readonly type: PaymentMethodTypeEnum;
  public config: ProviderConfig;
  public testBaseUrl: string;
  public productionBaseUrl: string;
  public timeoutMs: number;
  public isActive: boolean;

  constructor(props: PaymentMethodEntityProps) {
    super(props.id, props.createdAt, props.updatedAt, props.deletedAt);
    this.name = props.name;
    this.description = props.description;
    this.type = props.type;
    this.config = props.config;
    this.testBaseUrl = props.testBaseUrl;
    this.productionBaseUrl = props.productionBaseUrl;
    this.timeoutMs = props.timeoutMs ?? 30000;
    this.isActive = props.isActive ?? true;
  }

  public static create(props: Omit<PaymentMethodEntityProps, 'id' | 'createdAt' | 'updatedAt'>): PaymentMethodEntity {
    return new PaymentMethodEntity({
      ...props,
      id: generateUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public updateDescription(description: string): void {
    this.description = description;
    this.updatedAt = new Date();
  }

  public updateConfig(config: ProviderConfig): void {
    this.config = config;
    this.updatedAt = new Date();
  }

  public updateBaseUrls(testBaseUrl: string, productionBaseUrl: string): void {
    this.testBaseUrl = testBaseUrl;
    this.productionBaseUrl = productionBaseUrl;
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

  public getTypeLabel(): string {
    return PaymentMethodType[this.type];
  }

  public getBaseUrl(isProduction: boolean): string {
    return isProduction ? this.productionBaseUrl : this.testBaseUrl;
  }

  public toPublicObject(): Omit<PaymentMethodEntityProps, 'config'> & { configType: string } {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      configType: this.type === PaymentMethodTypeEnum.MPESA ? 'mpesa' : 'pesaflow',
      testBaseUrl: this.testBaseUrl,
      productionBaseUrl: this.productionBaseUrl,
      timeoutMs: this.timeoutMs,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}