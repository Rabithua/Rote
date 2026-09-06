import { render } from '@testing-library/react';
import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { describe, expect, it, vi } from 'vitest';
import AppSession from './AppSession';

vi.mock('@/hooks/useSiteStatus', () => ({
  useSiteStatus: () => ({ data: { site: { name: 'Rote', description: '' } } }),
}));
vi.mock('@/state/profile', () => ({ bootstrapAuthAtom: {} }));
vi.mock('jotai', () => ({ useSetAtom: () => vi.fn() }));
vi.mock('./CustomHeadScripts', () => ({ default: () => null }));
vi.mock('./ScrollPositionManager', () => ({ default: () => null }));

describe('application session metadata', () => {
  it('accepts a site with an empty description without giving Helmet a string child', () => {
    expect(() =>
      render(
        <HelmetProvider>
          <AppSession />
        </HelmetProvider>
      )
    ).not.toThrow();
  });
});
