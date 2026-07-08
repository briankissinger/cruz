import { inject } from 'inversify';
import { Controller, Get, Post, Request as request, Response as response, Next as next } from '@inversifyjs/http-core';
import type { Request, Response, NextFunction } from 'express';
import { TYPES } from '../../infra/config/inversify.config.js';
import { TransactionService } from '../../app/services/transaction.service.js';
import { PaymentProviderService } from '../../app/services/payment-provider.service.js';
import { validationPipe } from '../pipes/index.js';
import { exceptionFilter } from '../filters/index.js';
import { HTTP_STATUS, ERROR_CODES } from '../../config/constants.js';
import { logger } from '../middlewares/index.js';
import { uuidv7 } from 'uuidv7';

@Controller('/api/v1')
export class TransactionController {
  constructor(
    @inject(TYPES.TransactionService) private transactionService: TransactionService,
    @inject(TYPES.PaymentProviderService) private paymentProviderService: PaymentProviderService,
    @inject(TYPES.ValidationPipe) private validate: validationPipe,
    @inject(TYPES.ExceptionFilter) private exceptionFilter: exceptionFilter,
  ) {}

  /**
   * @openapi
   * /api/v1/payments/initiate:
   *   post:
   *     tags: [Payments]
   *     summary: Initiate a payment
   */
  @Post('/payments/initiate')
  async initiatePayment(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const customerId = (req as any).user?.customerId;
      if (!customerId) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
      }

      const body = req.body;
      const validation = await this.validate.transform(body, {
        invoiceNumber: { required: true, type: 'string', minLength: 1 },
        amount: { required: true, type: 'number', min: 1 },
        paymentMethodId: { required: true, type: 'string', minLength: 36 },
        payeeName: { type: 'string' },
        payeeAccount: { type: 'string' },
        paymentDescription: { type: 'string' },
      });

      if (validation.error) {
        res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({ error: ERROR_CODES.VALIDATION_ERROR, message: validation.error });
        return;
      }

      const merchantRequestId = uuidv7();
      const checkoutRequestId = uuidv7();

      const transaction = await this.transactionService.initiatePayment({
        customerId: customerId,
        invoiceNumber: body.invoiceNumber,
        merchantRequestId,
        checkoutRequestId,
        amount: body.amount,
        paymentMethodId: body.paymentMethodId,
        payeeName: body.payeeName,
        payeeAccount: body.payeeAccount,
        paymentDescription: body.paymentDescription,
      });

      const providerResponse = await this.paymentProviderService.initiatePayment({
        merchantRequestId,
        checkoutRequestId,
        amount: body.amount,
        paymentMethodId: body.paymentMethodId,
        payeeName: body.payeeName,
        payeeAccount: body.payeeAccount,
        paymentDescription: body.paymentDescription,
        callbackUrl: `${req.protocol}://${req.get('host')}/api/v1/webhooks/payment`,
      });

      if (!providerResponse.success) {
        await this.transactionService.failPayment({
          merchantRequestId,
          checkoutRequestId,
          resultCode: providerResponse.resultCode,
          providerResponse: providerResponse.rawResponse,
          failureReason: providerResponse.resultDescription,
        });

        res.status(HTTP_STATUS.BAD_GATEWAY).json({
          error: ERROR_CODES.PAYMENT_PROVIDER_ERROR,
          message: 'Payment provider declined the request',
          providerResponse: providerResponse.rawResponse,
        });
        return;
      }

      transaction.markAsProcessing();
      await this.transactionService['transactionRepository'].update(transaction);

      res.status(HTTP_STATUS.CREATED).json({
        merchantRequestId: transaction.merchantRequestId,
        checkoutRequestId: transaction.checkoutRequestId,
        invoiceNumber: transaction.invoiceNumber,
        amount: transaction.amount,
        status: transaction.getStatusLabel(),
        providerResponse: {
          resultCode: providerResponse.resultCode,
          resultDescription: providerResponse.resultDescription,
          transactionCode: providerResponse.transactionCode,
        },
      });
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/transactions/{id}:
   *   get:
   *     tags: [Transactions]
   *     summary: Get a transaction by ID
   */
  @Get('/transactions/:id')
  async getTransaction(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const transaction = await this.transactionService.getTransactionById(id as any);

      if (!transaction) {
        res.status(HTTP_STATUS.NOT_FOUND).json({ error: ERROR_CODES.NOT_FOUND, message: 'Transaction not found' });
        return;
      }

      res.status(HTTP_STATUS.OK).json(transaction.toPublicObject());
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/transactions:
   *   get:
   *     tags: [Transactions]
   *     summary: Get customer transactions with pagination
   */
  @Get('/transactions')
  async getCustomerTransactions(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const customerId = (req as any).user?.customerId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.transactionService.getCustomerTransactions(customerId, page, limit);
      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      this.exceptionFilter.catch(error, req, res, nxt);
    }
  }

  /**
   * @openapi
   * /api/v1/webhooks/payment:
   *   post:
   *     tags: [Webhooks]
   *     summary: Handle payment provider webhook callback
   */
  @Post('/webhooks/payment')
  async handlePaymentProviderWebhook(@request() req: Request, @response() res: Response, @next() nxt: NextFunction): Promise<void> {
    try {
      const rawBody = JSON.stringify(req.body);
      logger.info({ body: rawBody }, 'payment provider webhook received');

      const { merchantRequestID, checkoutRequestID, resultCode, resultDescription, transactionCode, amount } = req.body;

      const signature = req.headers['x-webhook-signature'] as string;
      if (signature) {
        const txn = merchantRequestID
          ? await this.transactionService.getTransactionByMerchantRequestId(merchantRequestID)
          : null;
        const isValid = await this.paymentProviderService.verifyWebhookSignature(rawBody, signature, txn?.paymentMethodId ?? '');
        if (!isValid) {
          logger.warn({ signature }, 'invalid webhook signature');
          res.status(HTTP_STATUS.FORBIDDEN).json({ error: ERROR_CODES.WEBHOOK_VERIFICATION_FAILED, message: 'Invalid webhook signature' });
          return;
        }
      }

      if (!merchantRequestID || !checkoutRequestID) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({ error: ERROR_CODES.VALIDATION_ERROR, message: 'Missing merchantRequestID or checkoutRequestID' });
        return;
      }

      if (resultCode === '0' || resultCode === 'success') {
        const transaction = await this.transactionService.completePayment({
          merchantRequestId: merchantRequestID,
          checkoutRequestId: checkoutRequestID,
          transactionCode: transactionCode || uuidv7(),
          actualAmount: amount || 0,
          resultCode: resultCode || '0',
          providerResponse: req.body,
        });

        logger.info({ transactionId: transaction.id, status: 'completed' }, 'payment completed successfully');

        const webhookPayload = await this.transactionService.buildWebhookPayload(transaction);

        res.status(HTTP_STATUS.OK).json({
          received: true,
          ...webhookPayload,
        });
      } else {
        const failedTransaction = await this.transactionService.failPayment({
          merchantRequestId: merchantRequestID,
          checkoutRequestId: checkoutRequestID,
          resultCode: resultCode || 'FAILED',
          providerResponse: req.body,
          failureReason: resultDescription || 'Payment failed',
        });

        logger.info({ failedTransactionId: failedTransaction.id, reason: resultDescription }, 'payment failed');

        res.status(HTTP_STATUS.OK).json({
          received: true,
          status: 'failed',
          failedTransactionId: failedTransaction.id,
        });
      }
    } catch (error) {
      logger.error({ error }, 'error processing payment webhook');
      res.status(HTTP_STATUS.OK).json({ received: true });
    }
  }
}
