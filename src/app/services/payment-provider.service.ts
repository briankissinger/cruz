import { inject, injectable } from 'inversify';
import { TYPES } from '../../infra/config/inversify.config.js';
import type { IPaymentMethodRepository } from '../../core/interfaces/repository/index.js';

export interface PaymentProviderRequest {
  merchantRequestId: string;
  checkoutRequestId: string;
  amount: number;
  paymentMethodId: string;
  payeeName?: string;
  payeeAccount?: string;
  paymentDescription?: string;
  callbackUrl?: string;
}

export interface PaymentProviderResponse {
  success: boolean;
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: string;
  resultDescription: string;
  transactionCode?: string;
  rawResponse: Record<string, unknown>;
}

export interface PaymentProviderConfig {
  baseUrl: string;
  merchantId: string;
  apiKey: string;
  webhookSecret: string;
  timeout: number;
}

export interface PaymentProviderStatus {
  code: string;
  description: string;
  isSuccess: boolean;
  isFailed: boolean;
  isPending: boolean;
}

@injectable()
export class PaymentProviderService {
  constructor(
    @inject(TYPES.PaymentMethodRepository) private paymentMethodRepository: IPaymentMethodRepository,
  ) {}

  private async getConfig(paymentMethodId: string): Promise<PaymentProviderConfig> {
    const paymentMethod = await this.paymentMethodRepository.findById(paymentMethodId as any);
    if (!paymentMethod) {
      throw new Error(`Payment method not found: ${paymentMethodId}`);
    }

    const config = paymentMethod.config as unknown as Record<string, string | undefined>;

    return {
      baseUrl: paymentMethod.productionBaseUrl,
      merchantId: config.shortCode ?? config.apiClientId ?? '',
      apiKey: config.consumerKey ?? config.apiKey ?? '',
      webhookSecret: config.passKey ?? config.apiSecret ?? '',
      timeout: paymentMethod.timeoutMs,
    };
  }

  async initiatePayment(request: PaymentProviderRequest): Promise<PaymentProviderResponse> {
    const providerConfig = await this.getConfig(request.paymentMethodId);

    try {
      const response = await fetch(`${providerConfig.baseUrl}/api/v1/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${providerConfig.apiKey}`,
          'X-Merchant-ID': providerConfig.merchantId,
        },
        body: JSON.stringify({
          merchantRequestID: request.merchantRequestId,
          checkoutRequestID: request.checkoutRequestId,
          amount: request.amount,
          payeeName: request.payeeName,
          payeeAccount: request.payeeAccount,
          paymentDescription: request.paymentDescription,
          callbackURL: request.callbackUrl,
        }),
        signal: AbortSignal.timeout(providerConfig.timeout),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          merchantRequestId: request.merchantRequestId,
          checkoutRequestId: request.checkoutRequestId,
          resultCode: `PROVIDER_${response.status}`,
          resultDescription: `Provider returned status ${response.status}: ${errorBody}`,
          rawResponse: { statusCode: response.status, body: errorBody },
        };
      }

      const data = await response.json() as Record<string, unknown>;
      return {
        success: true,
        merchantRequestId: (data.merchantRequestID as string) || request.merchantRequestId,
        checkoutRequestId: (data.checkoutRequestID as string) || request.checkoutRequestId,
        resultCode: (data.resultCode as string) || '0',
        resultDescription: (data.resultDescription as string) || 'Success',
        transactionCode: data.transactionCode as string,
        rawResponse: data,
      };
    } catch (error: any) {
      return {
        success: false,
        merchantRequestId: request.merchantRequestId,
        checkoutRequestId: request.checkoutRequestId,
        resultCode: 'PROVIDER_ERROR',
        resultDescription: error.message || 'Payment provider communication failed',
        rawResponse: { error: error.message },
      };
    }
  }

  async checkTransactionStatus(merchantRequestId: string, paymentMethodId: string): Promise<PaymentProviderResponse> {
    const providerConfig = await this.getConfig(paymentMethodId);

    try {
      const response = await fetch(`${providerConfig.baseUrl}/api/v1/payments/${merchantRequestId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${providerConfig.apiKey}`,
          'X-Merchant-ID': providerConfig.merchantId,
        },
        signal: AbortSignal.timeout(providerConfig.timeout),
      });

      if (!response.ok) {
        return {
          success: false,
          merchantRequestId,
          checkoutRequestId: '',
          resultCode: `PROVIDER_${response.status}`,
          resultDescription: `Status check failed with status ${response.status}`,
          rawResponse: { statusCode: response.status },
        };
      }

      const data = await response.json() as Record<string, unknown>;
      return {
        success: data.status === 'success',
        merchantRequestId,
        checkoutRequestId: (data.checkoutRequestID as string) || '',
        resultCode: (data.resultCode as string) || '0',
        resultDescription: (data.resultDescription as string) || '',
        transactionCode: data.transactionCode as string,
        rawResponse: data,
      };
    } catch (error: any) {
      return {
        success: false,
        merchantRequestId,
        checkoutRequestId: '',
        resultCode: 'PROVIDER_ERROR',
        resultDescription: error.message || 'Status check failed',
        rawResponse: { error: error.message },
      };
    }
  }

  async verifyWebhookSignature(payload: string, signature: string, paymentMethodId: string): Promise<boolean> {
    const providerConfig = await this.getConfig(paymentMethodId);
    return signature === providerConfig.webhookSecret;
  }

  async getWebhookSecret(paymentMethodId: string): Promise<string> {
    const providerConfig = await this.getConfig(paymentMethodId);
    return providerConfig.webhookSecret;
  }
}
