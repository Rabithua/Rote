import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AiMessageItem } from './AiMessageItem';
import type { AiMemoryMessage } from '@/state/aiChat';

vi.unmock('react-dom/client');
vi.mock('@/hooks/useAiAnswerExport', () => ({
  useAiAnswerExport: () => ({
    exporting: false,
    handleExportImage: vi.fn(),
    handleExportPdf: vi.fn(),
  }),
}));
vi.mock('@/state/profile', () => ({ useProfile: () => null }));
vi.mock('./AiStreamingMarkdown', () => ({
  default: ({ content }: { content: string }) => <p>{content}</p>,
}));

afterEach(cleanup);

it('keeps each round body under its own collapsible thinking row without moving it on classification', () => {
  const message: AiMemoryMessage = {
    id: 'reply',
    role: 'assistant',
    content: '',
    isStreaming: true,
    outputs: [
      {
        outputId: 'step-0',
        phase: 'planning',
        text: 'First body',
        thinking: 'First reasoning',
        thinkingPhase: 'route_decision',
      },
    ],
  };
  const { container, rerender } = render(
    <MemoryRouter>
      <AiMessageItem message={message} />
    </MemoryRouter>
  );
  const firstRound = container.querySelector('[data-output-id="step-0"]')!;
  expect(firstRound.textContent).toContain('First body');
  const next: AiMemoryMessage = {
    ...message,
    outputs: [
      { ...message.outputs![0], kind: 'process' },
      {
        outputId: 'step-1',
        phase: 'tool_calling',
        text: 'Second body',
        thinking: 'Second reasoning',
        thinkingPhase: 'evidence_decision',
      },
      {
        outputId: 'step-2',
        phase: 'tool_calling',
        text: 'Final body',
        thinking: 'Final reasoning',
        thinkingPhase: 'evidence_decision',
      },
    ],
  };
  rerender(
    <MemoryRouter>
      <AiMessageItem message={next} />
    </MemoryRouter>
  );
  expect(container.querySelector('[data-output-id="step-0"]')).toBe(firstRound);
  expect(
    Array.from(container.querySelectorAll('[data-output-id]')).map((element) =>
      element.getAttribute('data-output-id')
    )
  ).toEqual(['step-0', 'step-1', 'step-2']);
  const buttons = screen.getAllByRole('button', { name: 'thinkingTrace.expand' });
  const ids = buttons.map((button) => button.getAttribute('aria-controls'));
  expect(new Set(ids).size).toBe(3);
  fireEvent.click(buttons[1]);
  expect(document.getElementById(ids[1]!)).toBeVisible();
  expect(document.getElementById(ids[2]!)).not.toBeVisible();
  expect(document.getElementById(ids[1]!)?.textContent).toBe('Second reasoning');
  const finalRound = container.querySelector('[data-output-id="step-2"]');
  const { text: _text, ...finalMetadata } = next.outputs![2];
  rerender(
    <MemoryRouter>
      <AiMessageItem
        message={{
          ...next,
          content: 'Final body',
          isStreaming: false,
          outputs: [
            next.outputs![0],
            { ...next.outputs![1], kind: 'process' },
            { ...finalMetadata, kind: 'answer' },
          ],
        }}
      />
    </MemoryRouter>
  );
  expect(container.querySelector('[data-output-id="step-2"]')).toBe(finalRound);
  expect(screen.getAllByText('Final body')).toHaveLength(1);
  expect(firstRound.textContent).toContain('First body');
});
