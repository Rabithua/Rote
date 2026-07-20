import { describe, expect, it } from 'bun:test';
import {
  CUSTOM_HEAD_SCRIPTS_MAX_BYTES,
  normalizeCustomHeadScripts,
  resolveCustomHeadScriptsUpdate,
} from './customHeadScripts';

describe('normalizeCustomHeadScripts', () => {
  it('accepts multiple external and inline scripts', () => {
    const value = `
      <!-- analytics -->
      <script defer src="https://example.com/telemetry.js" data-product-id="123"></script>
      <script>window.exampleReady = true;</script>
    `;

    expect(normalizeCustomHeadScripts(value)).toBe(value);
  });

  it('normalizes an empty value to undefined', () => {
    expect(normalizeCustomHeadScripts('')).toBeUndefined();
    expect(normalizeCustomHeadScripts(undefined)).toBeUndefined();
  });

  it('rejects non-script HTML', () => {
    expect(() => normalizeCustomHeadScripts('<meta name="theme-color" content="red">')).toThrow(
      'may only contain <script> tags'
    );
  });

  it('rejects malformed HTML', () => {
    expect(() => normalizeCustomHeadScripts('<script src="broken></script>')).toThrow(
      'malformed HTML'
    );
  });

  it('rejects values larger than 64 KiB', () => {
    const oversized = `<script>${'a'.repeat(CUSTOM_HEAD_SCRIPTS_MAX_BYTES)}</script>`;
    expect(() => normalizeCustomHeadScripts(oversized)).toThrow('must not exceed 64 KiB');
  });
});

describe('resolveCustomHeadScriptsUpdate', () => {
  const existing = '<script src="https://example.com/old.js"></script>';
  const incoming = '<script src="https://example.com/new.js"></script>';

  it('allows a super admin to change or clear scripts', () => {
    expect(resolveCustomHeadScriptsUpdate(existing, incoming, true)).toBe(incoming);
    expect(resolveCustomHeadScriptsUpdate(existing, '', true)).toBeUndefined();
  });

  it('allows an admin to save an unchanged value', () => {
    expect(resolveCustomHeadScriptsUpdate(existing, existing, false)).toBe(existing);
  });

  it('prevents an admin from changing or clearing scripts', () => {
    expect(() => resolveCustomHeadScriptsUpdate(existing, incoming, false)).toThrow(
      'Only super admin can modify custom head scripts'
    );
    expect(() => resolveCustomHeadScriptsUpdate(existing, '', false)).toThrow(
      'Only super admin can modify custom head scripts'
    );
  });
});
