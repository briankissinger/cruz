import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { getConfig } from '../../config/env.js';
import { APP_CONSTANTS } from '../../config/constants.js';
import { logger } from '../../api/middlewares/index.js';

let sdk: NodeSDK | null = null;

export function initializeTelemetry(): NodeSDK | null {
  const config = getConfig();

  if (!config.OTEL_EXPORTER_OTLP_ENDPOINT) {
    logger.info('OpenTelemetry exporter endpoint not configured, skipping telemetry initialization');
    return null;
  }

  const traceExporter = new OTLPTraceExporter({
    url: `${config.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
    headers: config.OTEL_EXPORTER_OTLP_HEADERS
      ? Object.fromEntries(
          config.OTEL_EXPORTER_OTLP_HEADERS.split(',').map((h) => {
            const [key, ...rest] = h.split('=');
            return [key.trim(), rest.join('=').trim()];
          }),
        )
      : undefined,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.OTEL_SERVICE_NAME || APP_CONSTANTS.APP_NAME,
      [ATTR_SERVICE_VERSION]: APP_CONSTANTS.APP_VERSION,
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          ignoreIncomingRequestHook: (request) => {
            return request.url === '/health' || request.url?.startsWith('/metrics') || false;
          },
        },
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-pg': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-redis': {
          enabled: true,
        },
      }),
    ],
  });

  sdk.start();

  logger.info({
    serviceName: config.OTEL_SERVICE_NAME,
    endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
  }, 'OpenTelemetry initialized');

  return sdk;
}

export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      logger.info('OpenTelemetry shut down');
    } catch (error: any) {
      logger.error({ error: error.message }, 'error shutting down OpenTelemetry');
    }
  }
}