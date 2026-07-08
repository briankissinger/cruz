import { getConfig } from '../../config/env.js';
import swaggerJsdoc from 'swagger-jsdoc';

const config = getConfig();

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'Cruz Payment Gateway API',
      version: '1.0.0',
      description: `Enterprise-grade multi-tenant payment gateway.

## Authentication
The API uses **Bearer JWT** tokens obtained via Basic authentication (\`Authorization: Basic base64(clientId:clientSecret)\`).

## API Key
Some endpoints require an \`x-api-key\` header for rate limiting and tenant identification.

## Error Handling
All errors follow the format:
\`\`\`json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
\`\`\`

## Webhooks
Payment status updates are delivered to registered tenant webhook URLs via BullMQ workers with exponential backoff (max 5 retries).`,
      contact: {
        name: 'Cruz Team',
        url: 'https://github.com/anomalyco/cruz',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.PORT}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token obtained via Basic auth',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'Tenant API key for rate limiting and identification',
        },
        basicAuth: {
          type: 'http',
          scheme: 'basic',
          description: 'Basic authentication using clientId:clientSecret',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error code' },
            message: { type: 'string', description: 'Human-readable error message' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: 'UUID v7' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            status: { type: 'integer', description: '0=active, 1=inactive, 2=suspended' },
            statusLabel: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateUserInput: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
          },
        },
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            clientId: { type: 'string' },
            apiKey: { type: 'string' },
            name: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateCustomerInput: {
          type: 'object',
          required: ['userId', 'name'],
          properties: {
            userId: { type: 'string', format: 'uuid', description: 'UUID v7 of the user' },
            name: { type: 'string', minLength: 1, maxLength: 255 },
          },
        },
        PaymentMethod: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'integer', description: '0=M-PESA, 1=PesaFlow' },
            configType: { type: 'string', enum: ['mpesa', 'pesaflow'] },
            testBaseUrl: { type: 'string' },
            productionBaseUrl: { type: 'string' },
            timeoutMs: { type: 'integer' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreatePaymentMethodInput: {
          type: 'object',
          required: ['name', 'type', 'testBaseUrl', 'productionBaseUrl', 'config'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string', enum: ['mpesa', 'pesaflow'] },
            testBaseUrl: { type: 'string' },
            productionBaseUrl: { type: 'string' },
            config: { type: 'object', description: 'Provider-specific configuration' },
          },
        },
        Application: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            customerId: { type: 'string', format: 'uuid' },
            paymentMethodId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            configType: { type: 'string' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            applicationId: { type: 'string', format: 'uuid' },
            customerId: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            reference: { type: 'string' },
            status: { type: 'integer', description: '0=PENDING, 1=SUCCESSFUL, 2=FAILED, 3=REFUNDED' },
            statusLabel: { type: 'string', enum: ['pending', 'successful', 'failed', 'refunded'] },
            providerReference: { type: 'string' },
            callbackUrl: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        InitiatePaymentInput: {
          type: 'object',
          required: ['invoiceNumber', 'amount', 'paymentMethodId'],
          properties: {
            invoiceNumber: { type: 'string', minLength: 1 },
            amount: { type: 'number', minimum: 1 },
            paymentMethodId: { type: 'string', format: 'uuid', minLength: 36 },
            payeeName: { type: 'string' },
            payeeAccount: { type: 'string' },
            paymentDescription: { type: 'string' },
          },
        },
        TokenResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'integer' },
            tokenType: { type: 'string', example: 'Bearer' },
          },
        },
        WebhookRegistration: {
          type: 'object',
          required: ['webhookUrl', 'secret', 'events'],
          properties: {
            webhookUrl: { type: 'string', format: 'uri' },
            secret: { type: 'string', minLength: 16 },
            events: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
            },
          },
        },
        PaginatedResult: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'Token management and authentication' },
      { name: 'Users', description: 'User management' },
      { name: 'Customers', description: 'Customer/tenant management' },
      { name: 'Applications', description: 'Payment application configuration' },
      { name: 'Payment Methods', description: 'Payment provider method management' },
      { name: 'Transactions', description: 'Payment transaction processing' },
      { name: 'Webhooks', description: 'Tenant webhook registration and management' },
      { name: 'Health', description: 'Health check endpoints' },
    ],
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);