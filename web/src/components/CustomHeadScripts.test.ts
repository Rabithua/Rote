import { afterEach, describe, expect, it } from 'vitest';
import { injectCustomHeadScripts } from './CustomHeadScripts';

const selector = '[data-rote-custom-head-script="true"]';

afterEach(() => {
  document.head.querySelectorAll(selector).forEach((script) => script.remove());
});

describe('injectCustomHeadScripts', () => {
  it('copies external script attributes and inline content into document.head', async () => {
    await injectCustomHeadScripts(`
      <script async src="https://example.com/telemetry.js" data-product-id="product-1"></script>
      <script>window.customTelemetryLoaded = true;</script>
    `);

    const scripts = Array.from(document.head.querySelectorAll<HTMLScriptElement>(selector));
    expect(scripts).toHaveLength(2);
    expect(scripts[0]).toHaveAttribute('src', 'https://example.com/telemetry.js');
    expect(scripts[0]).toHaveAttribute('async');
    expect(scripts[0]).toHaveAttribute('data-product-id', 'product-1');
    expect(scripts[1].textContent).toContain('window.customTelemetryLoaded = true');
  });

  it('waits for a blocking external script before appending the next script', async () => {
    const injection = injectCustomHeadScripts(`
      <script src="https://example.com/dependency.js"></script>
      <script>window.dependencyConsumer = true;</script>
    `);

    const firstScript = document.head.querySelector<HTMLScriptElement>(selector);
    expect(firstScript).not.toBeNull();
    expect(document.head.querySelectorAll(selector)).toHaveLength(1);

    firstScript?.dispatchEvent(new Event('load'));
    await injection;

    expect(document.head.querySelectorAll(selector)).toHaveLength(2);
  });
});
