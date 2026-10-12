import { expect, test } from 'bun:test';
import { deploymentRevision } from './revision';

test('rejects invalid revision values before building HTML', () => {
  expect(() => deploymentRevision('<script>')).toThrow('full Git commit SHA');
  expect(() => deploymentRevision('abc123')).toThrow('full Git commit SHA');
});

test('emits the revision into HTML before PWA precaching', () => {
  const revision = 'a'.repeat(40);
  const transform = deploymentRevision(revision).transformIndexHtml;
  expect(typeof transform).toBe('function');
  if (typeof transform !== 'function') throw new Error('Expected HTML transform');
  expect(transform('', { path: '/', filename: 'index.html' })).toEqual([
    { tag: 'meta', attrs: { name: 'rote-revision', content: revision } },
  ]);
});
