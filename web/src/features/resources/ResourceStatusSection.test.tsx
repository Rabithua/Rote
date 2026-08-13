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
});
