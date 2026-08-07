import type { BillingConfig } from './config';
import type { BillingGrantDelivery } from './grantSnapshot';
import {
  PAID_ACTIVATION_PATH,
  PAID_SESSION_PATH,
  PaidContractError,
  parsePaidActivationResponse,
  parsePaidErrorResponse,
  parsePaidSessionResponse,
  serializePaidActivationRequest,
  serializePaidSessionRequest,
  type PaidAppErrorMessage,
  type PaidInternalErrorMessage,
} from './paidContract';
import {
  PaidBillingTransport,
  PaidTransportError,
  type BillingFetch,
  type PaidTransportResponse,
} from './paidTransport';

type EnabledBillingConfig = Extract<BillingConfig, { enabled: true }>;

export type PaidBillingProvider = {
  createSession(userId: string): Promise<{ appAccountToken: string }>;
  activate(userId: string, signedTransactionInfo: string): Promise<BillingGrantDelivery>;
};

export class PaidBillingApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly billingMessage: PaidAppErrorMessage,
    public readonly internalCause?: PaidBillingInternalContractError
  ) {
    super(billingMessage);
    this.name = 'PaidBillingApiError';
  }
}

export class PaidBillingInternalContractError extends Error {
  constructor(
    public readonly status: number,
    public readonly billingMessage: PaidInternalErrorMessage
  ) {
    super(billingMessage);
    this.name = 'PaidBillingInternalContractError';
  }
}

function providerUnavailable(
  internalCause?: PaidBillingInternalContractError
): PaidBillingApiError {
  return new PaidBillingApiError(503, 'billing_provider_unavailable', internalCause);
}

function parseSuccessOrThrow<T>(
  response: PaidTransportResponse,
  parseSuccess: (value: unknown) => T
): T {
  if (response.status === 200) {
    try {
      return parseSuccess(response.body);
    } catch (error) {
      if (error instanceof PaidContractError) throw providerUnavailable();
      throw error;
    }
  }

  let failure: ReturnType<typeof parsePaidErrorResponse>;
  try {
    failure = parsePaidErrorResponse({ status: response.status, value: response.body });
  } catch {
    throw providerUnavailable();
  }
  if (failure.message === 'billing_idempotency_conflict') {
    throw new PaidBillingInternalContractError(failure.status, failure.message);
  }
  throw new PaidBillingApiError(failure.status, failure.message);
}

export class PaidBillingClient implements PaidBillingProvider {
  private readonly transport: PaidBillingTransport;
  private readonly now: () => Date;

  constructor(
    private readonly config: EnabledBillingConfig,
    dependencies: {
      fetch?: BillingFetch;
      now?: () => Date;
      requestId?: () => string;
      transport?: PaidBillingTransport;
    } = {}
  ) {
    this.transport =
      dependencies.transport ??
      new PaidBillingTransport(config, {
        fetch: dependencies.fetch,
        now: dependencies.now,
        requestId: dependencies.requestId,
      });
    this.now = dependencies.now ?? (() => new Date());
  }

  async createSession(userId: string): Promise<{ appAccountToken: string }> {
    try {
      const response = await this.transport.postJson(PAID_SESSION_PATH, (requestId) =>
        serializePaidSessionRequest({ requestId, instanceId: this.config.instanceId, userId })
      );
      return parseSuccessOrThrow(response, parsePaidSessionResponse);
    } catch (error) {
      if (error instanceof PaidBillingApiError) throw error;
      if (error instanceof PaidBillingInternalContractError) throw providerUnavailable(error);
      if (error instanceof PaidTransportError) throw providerUnavailable();
      throw error;
    }
  }

  async activate(userId: string, signedTransactionInfo: string): Promise<BillingGrantDelivery> {
    try {
      const response = await this.transport.postJson(PAID_ACTIVATION_PATH, (requestId) =>
        serializePaidActivationRequest({
          requestId,
          instanceId: this.config.instanceId,
          userId,
          signedTransactionInfo,
        })
      );
      return parseSuccessOrThrow(response, (value) =>
        parsePaidActivationResponse({
          value,
          instanceId: this.config.instanceId,
          productIds: this.config.productIds,
          receivedAt: this.now(),
        })
      );
    } catch (error) {
      if (error instanceof PaidBillingApiError) throw error;
      if (error instanceof PaidBillingInternalContractError) throw providerUnavailable(error);
      if (error instanceof PaidTransportError) throw providerUnavailable();
      throw error;
    }
  }
}
