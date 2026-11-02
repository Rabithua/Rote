import { cloneElement, type ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AiUsageTrend from './AiUsageTrend';
import type { AiUsageMetrics } from './types';

vi.unmock('react-dom/client');
vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactElement<Record<string, unknown>> }) =>
    cloneElement(children, { width: 640, height: 256 }),
}));

const metrics: AiUsageMetrics = {
  totalTokens: '9007199254740993',
  promptTokens: '100',
  completionTokens: '20',
  calls: 2,
  reportedCalls: 1,
  unknownCalls: 1,
  legacyRecords: 0,
  failedCalls: 0,
  cancelledCalls: 0,
  cacheHitTokens: null,
  cacheMissTokens: null,
  reasoningTokens: null,
  cacheHitReportedCalls: 0,
  cacheMissReportedCalls: 0,
  reasoningReportedCalls: 0,
};
const range = {
  startAt: '2026-09-30T16:00:00Z',
  endAt: '2026-10-01T04:00:00Z',
  timeZone: 'Asia/Shanghai',
};

describe('AI usage trend chart', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 640,
      bottom: 256,
      width: 640,
      height: 256,
      toJSON: () => ({}),
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders a meaningful empty state without axes or a misleading flat line', () => {
    render(<AiUsageTrend daily={[]} range={range} />);
    expect(screen.getByText('trendEmpty')).toBeVisible();
    expect(screen.queryByRole('application')).not.toBeInTheDocument();
  });

  it('renders all three series and visible points for a single-day range', () => {
    const view = render(<AiUsageTrend daily={[{ date: '2026-10-01', metrics }]} range={range} />);
    expect(screen.getByText('trendTitle')).toBeVisible();
    expect(screen.getByText('totalUsage')).toBeVisible();
    expect(screen.getByText('promptTokens')).toBeVisible();
    expect(screen.getByText('completionTokens')).toBeVisible();
    expect(view.container.querySelectorAll('.recharts-line')).toHaveLength(3);
    expect(view.container.querySelectorAll('.recharts-line-dot')).toHaveLength(3);
  });

  it('shows exact tokens and unreported-call coverage when inspected with a keyboard', async () => {
    render(<AiUsageTrend daily={[{ date: '2026-10-01', metrics }]} range={range} />);
    const chart = screen.getByRole('application');
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(await screen.findByText('9,007,199,254,740,993')).toBeVisible();
    expect(screen.getByText('trendUnknown')).toBeVisible();
  });

  it('shows daily details on pointer hover', async () => {
    const view = render(<AiUsageTrend daily={[{ date: '2026-10-01', metrics }]} range={range} />);
    const wrapper = view.container.querySelector('.recharts-wrapper')!;
    fireEvent.mouseMove(wrapper, { clientX: 320, clientY: 100 });
    await waitFor(() => expect(screen.getByText('9,007,199,254,740,993')).toBeVisible());
  });

  it('shows daily details when a day is tapped without first hovering', async () => {
    const view = render(<AiUsageTrend daily={[{ date: '2026-10-01', metrics }]} range={range} />);
    fireEvent.click(view.container.querySelector('.recharts-wrapper')!, {
      clientX: 320,
      clientY: 100,
    });
    expect(await screen.findByText('9,007,199,254,740,993')).toBeVisible();
  });

  it('shows unreported usage as unknown rather than a false zero', async () => {
    const unknown = {
      ...metrics,
      totalTokens: null,
      promptTokens: null,
      completionTokens: null,
      reportedCalls: 0,
    };
    render(<AiUsageTrend daily={[{ date: '2026-10-01', metrics: unknown }]} range={range} />);
    fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getAllByText('unknown')).toHaveLength(3));
    expect(screen.getByText('trendUnknown')).toBeVisible();
  });

  it('preserves a single reported day between unknown days as visible dots', () => {
    const unknown = {
      ...metrics,
      totalTokens: null,
      promptTokens: null,
      completionTokens: null,
      reportedCalls: 0,
    };
    const view = render(
      <AiUsageTrend
        daily={[
          { date: '2026-10-01', metrics: unknown },
          { date: '2026-10-02', metrics },
          { date: '2026-10-03', metrics: unknown },
        ]}
        range={{ ...range, endAt: '2026-10-03T16:00:00Z' }}
      />
    );
    const dots = view.container.querySelectorAll('.recharts-line-dot');
    expect(dots).toHaveLength(3);
    dots.forEach((dot) => expect(dot).toHaveAttribute('r', '2'));
  });

  it('marks only missing series unknown when total tokens alone were supplied', async () => {
    render(
      <AiUsageTrend
        daily={[
          {
            date: '2026-10-01',
            metrics: { ...metrics, promptTokens: null, completionTokens: null },
          },
        ]}
        range={range}
      />
    );
    fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' });
    expect(await screen.findByText('9,007,199,254,740,993')).toBeVisible();
    expect(screen.getAllByText('unknown')).toHaveLength(2);
  });
});
