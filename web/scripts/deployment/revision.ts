import type { Plugin } from 'vite';

export function deploymentRevision(revision: string | undefined): Plugin {
  if (revision && !/^[a-f0-9]{40}$/.test(revision)) {
    throw new Error('ROTE_BUILD_REVISION must be a full Git commit SHA');
  }

  return {
    name: 'deployment-revision',
    transformIndexHtml: () =>
      revision ? [{ tag: 'meta', attrs: { name: 'rote-revision', content: revision } }] : [],
  };
}
