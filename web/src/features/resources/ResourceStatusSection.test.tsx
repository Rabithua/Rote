import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ResourceStatusSection from './ResourceStatusSection';
import type { ResourceState } from './types';

const unmanagedState: ResourceState = {
  management: 'unmanaged',
  source: 'unmanaged',
  storage: {
    enforcement: 'off',
    usedBytes: null,
    reservedBytes: null,
    limitBytes: null,
    overLimit: null,
    canUpload: true,
  },
  openKey: {
    policy: 'unmanaged',
    creationThreshold: null,
    existingCount: 2,
    canCreate: true,
  },
};

describe('ResourceStatusSection', () => {
  it('describes unmanaged self-hosting without official Pro branding', () => {
    render(<ResourceStatusSection state={unmanagedState} isLoading={false} onRetry={vi.fn()} />);

    expect(screen.getByText('storage.notMeasured')).toBeInTheDocument();
    expect(screen.queryByText('title')).not.toBeInTheDocument();
    expect(screen.queryByText('planDescription.unmanaged')).not.toBeInTheDocument();
    expect(screen.queryByText('source.unmanaged')).not.toBeInTheDocument();
    expect(screen.queryByText('source.official_pro')).not.toBeInTheDocument();
  });

  it('does not trust official branding from a custom API origin', () => {
    render(
      <ResourceStatusSection
        state={{ ...unmanagedState, management: 'official', source: 'official_pro' }}
        isLoading={false}
        onRetry={vi.fn()}
      />
    );

    expect(screen.queryByText('storage.notMeasured')).not.toBeInTheDocument();
    expect(screen.queryByText('source.official_pro')).not.toBeInTheDocument();
  });

  it('does not present a placeholder zero while the official baseline is still running', () => {
    render(
      <ResourceStatusSection
        state={{
          ...unmanagedState,
          management: 'official',
          source: 'role_exempt',
          storage: {
            enforcement: 'observe',
            usedBytes: null,
            reservedBytes: '0',
            limitBytes: null,
            overLimit: null,
            canUpload: true,
          },
        }}
        isLoading={false}
        onRetry={vi.fn()}
        trustedOfficialPreview
      />
    );

    expect(screen.getByText('storage.reconciling')).toBeInTheDocument();
    expect(screen.queryByText('0 B')).not.toBeInTheDocument();
    expect(screen.queryByText('storage.noLimit')).not.toBeInTheDocument();
    expect(screen.queryByText('storage.uploading')).not.toBeInTheDocument();
  });

  it('labels role-exempt storage without implying a missing quota configuration', () => {
    render(
      <ResourceStatusSection
        state={{
          ...unmanagedState,
          management: 'official',
          source: 'role_exempt',
          storage: {
            enforcement: 'enforce',
            usedBytes: '123',
            reservedBytes: '0',
            limitBytes: null,
            overLimit: false,
            canUpload: true,
          },
        }}
        isLoading={false}
        onRetry={vi.fn()}
        trustedOfficialPreview
      />
    );

    expect(screen.getByText('storage.roleExemptLimit')).toBeInTheDocument();
    expect(screen.queryByText('storage.noLimit')).not.toBeInTheDocument();
  });
});
