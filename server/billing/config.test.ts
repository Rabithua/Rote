import { describe, expect, it } from 'bun:test';
import { loadBillingConfig } from './config';

function enabledEnvironment(): NodeJS.ProcessEnv {
  return {
    BILLING_ENABLED: 'true',
    BILLING_INSTANCE_ID: 'rote-official',
    BILLING_OFFICIAL_ORIGIN: 'https://api.rote.ink',
    BILLING_PAID_SERVER_URL: 'https://billing.rote.ink',
    BILLING_PRODUCT_IDS: 'ink.rote.pro.monthly,ink.rote.pro.quarterly,ink.rote.pro.yearly',
    BILLING_ROTE_TO_PAID_ACTIVE_KEY_ID: 'rote-active',
    BILLING_ROTE_TO_PAID_ACTIVE_SECRET: 'rote-to-paid-active-secret-00000001',
    BILLING_PAID_TO_ROTE_ACTIVE_KEY_ID: 'paid-active',
    BILLING_PAID_TO_ROTE_ACTIVE_SECRET: 'paid-to-rote-active-secret-00000001',
  };
}

describe('billing configuration', () => {
  it('defaults to disabled without requiring Paid configuration', () => {
    expect(loadBillingConfig({})).toEqual({ enabled: false });
    expect(
      loadBillingConfig({
        BILLING_ENABLED: 'false',
        BILLING_OFFICIAL_ORIGIN: 'not-a-url',
      })
    ).toEqual({ enabled: false });
  });

  it('parses a complete enabled configuration into directional key sets', () => {
    const config = loadBillingConfig({
      ...enabledEnvironment(),
      BILLING_PAID_TO_ROTE_PREVIOUS_KEY_ID: 'paid-previous',
      BILLING_PAID_TO_ROTE_PREVIOUS_SECRET: 'paid-to-rote-previous-secret-0001',
    });

    expect(config.enabled).toBe(true);
    if (!config.enabled) throw new Error('Expected enabled billing configuration');
    expect(config.productIds).toEqual([
      'ink.rote.pro.monthly',
      'ink.rote.pro.quarterly',
      'ink.rote.pro.yearly',
    ]);
    expect(config.connectTimeoutMs).toBe(3_000);
    expect(config.totalTimeoutMs).toBe(10_000);
    expect(config.paidToRote.previous?.keyId).toBe('paid-previous');
  });

  it('parses bounded Paid connection and total timeouts', () => {
    const config = loadBillingConfig({
      ...enabledEnvironment(),
      BILLING_PAID_CONNECT_TIMEOUT_MS: '1200',
      BILLING_PAID_TOTAL_TIMEOUT_MS: '4500',
    });
    expect(config.enabled && config.connectTimeoutMs).toBe(1_200);
    expect(config.enabled && config.totalTimeoutMs).toBe(4_500);
  });

  it('rejects non-official instances and lookalike origins', () => {
    expect(() =>
      loadBillingConfig({
        ...enabledEnvironment(),
        BILLING_INSTANCE_ID: 'rote-self-hosted',
      })
    ).toThrow('must be rote-official');
    expect(() =>
      loadBillingConfig({
        ...enabledEnvironment(),
        BILLING_OFFICIAL_ORIGIN: 'https://api.rote.ink.evil.example',
      })
    ).toThrow('must be https://api.rote.ink');
  });

  it('rejects unknown products, invalid URLs, timeouts, partial rotations, and shared secrets', () => {
    expect(() =>
      loadBillingConfig({
        ...enabledEnvironment(),
        BILLING_PRODUCT_IDS: 'ink.rote.pro.monthly,untrusted.product',
      })
    ).toThrow('not compiled into Rote');
    expect(() =>
      loadBillingConfig({
        ...enabledEnvironment(),
        BILLING_OFFICIAL_ORIGIN: 'https://api.rote.ink/path',
      })
    ).toThrow('exact HTTPS origin');
    expect(() =>
      loadBillingConfig({
        ...enabledEnvironment(),
        BILLING_PAID_CONNECT_TIMEOUT_MS: '5000',
        BILLING_PAID_TOTAL_TIMEOUT_MS: '1000',
      })
    ).toThrow('must not exceed total timeout');
    expect(() =>
      loadBillingConfig({
        ...enabledEnvironment(),
        BILLING_PAID_TO_ROTE_PREVIOUS_KEY_ID: 'paid-previous',
      })
    ).toThrow('configured together');
    expect(() =>
      loadBillingConfig({
        ...enabledEnvironment(),
        BILLING_PAID_TO_ROTE_ACTIVE_SECRET: 'rote-to-paid-active-secret-00000001',
      })
    ).toThrow('must be different');
  });
});
