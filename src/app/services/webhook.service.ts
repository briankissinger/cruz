import { injectable } from 'inversify';
import { getConfig } from '../../config/env.js';
import type { WebhookForwardPayload } from './transaction.service.js';

export interface TenantWebhookConfig {
  url: string;
  secret: string;
  timeout: number;
  maxRetries: number;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  attempt: number;
}

@injectable()
export class WebhookService {
  async deliverWebhook(
    webhookUrl: string,
    secret: string,
    payload: WebhookForwardPayload,
  ): Promise<WebhookDeliveryResult> {
    const config = getConfig();
    const timeout = config.TENANT_WEBHOOK_TIMEOUT_MS;
    const maxRetries = config.TENANT_WEBHOOK_MAX_RETRIES;

    let lastError: string | undefined;
    let lastStatusCode: number | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const body = JSON.stringify(payload);
        const signature = await this.generateSignature(body, secret);

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Timestamp': new Date().toISOString(),
            'User-Agent': 'Cruz-Webhook/1.0',
          },
          body,
          signal: AbortSignal.timeout(timeout),
        });

        lastStatusCode = response.status;

        if (response.ok) {
          return {
            success: true,
            statusCode: response.status,
            attempt,
          };
        }

        lastError = `HTTP ${response.status}: ${await response.text()}`;
      } catch (error: any) {
        lastError = error.message || 'Webhook delivery failed';
      }

      if (attempt < maxRetries) {
        await this.delay(Math.min(1000 * Math.pow(2, attempt), 30000));
      }
    }

    return {
      success: false,
      statusCode: lastStatusCode,
      error: lastError,
      attempt: maxRetries,
    };
  }

  async generateSignature(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    return signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
    return this.generateSignature(payload, secret).then((expected) => expected === signature);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}