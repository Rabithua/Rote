import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OpenKeySection from './OpenKeySection';

describe('OpenKeySection', () => {
  it('shows the official creation count inline without a separate status block', () => {
    render(
      <OpenKeySection
        openKeys={[]}
        isLoading={false}
        onCreateOpenKey={vi.fn()}
        onMutate={vi.fn()}
        canCreate={false}
        resourceState={{
          policy: 'threshold',
          creationThreshold: 1,
          existingCount: 3,
          canCreate: false,
        }}
      />
    );

    expect(screen.getByText('OpenKey')).toBeInTheDocument();
    expect(screen.getByText('（3/1）')).toBeInTheDocument();
    const message = screen.getByText(/resources.openKey.noNewTitle/);
    expect(message).toHaveClass('text-muted-foreground');
    expect(message).not.toHaveClass('text-destructive');
  });

  it('uses infinity for the official Pro creation allowance', () => {
    render(
      <OpenKeySection
        openKeys={[]}
        isLoading={false}
        onCreateOpenKey={vi.fn()}
        onMutate={vi.fn()}
        canCreate
        resourceState={{
          policy: 'unlimited',
          creationThreshold: null,
          existingCount: 6,
          canCreate: true,
        }}
      />
    );

    expect(screen.getByText('（6/∞）')).toBeInTheDocument();
  });
});
