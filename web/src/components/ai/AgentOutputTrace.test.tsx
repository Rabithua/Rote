import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AiMessageItem } from './AiMessageItem';
import type { AiMemoryMessage } from '@/state/aiChat';
import { createInstance } from 'i18next';
import en from '@/locales/en.json';
import zh from '@/locales/zh.json';

const translation = vi.hoisted(() => ({
  t: (key: string, _values?: Record<string, unknown>): string => key,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translation.t }),
}));

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

afterEach(() => {
  cleanup();
  translation.t = (key: string) => key;
});

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

it('renders saved round statuses in the current language, including their counts', async () => {
  const i18n = createInstance();
  await i18n.init({ lng: 'zh', resources: { en: { translation: en }, zh: { translation: zh } } });
  translation.t = (key, values) => i18n.t(`pages.aiMemory.${key}`, values || {});
  const message: AiMemoryMessage = {
    id: 'saved',
    role: 'assistant',
    content: 'Answer',
    outputs: [
      {
        outputId: 'step-0',
        phase: 'planning',
        kind: 'process',
        text: 'Process body',
        status: { type: 'sources', added: 2, count: 5 },
      },
      {
        outputId: 'step-1',
        phase: 'answering',
        kind: 'answer',
        status: { type: 'phase', phase: 'answering' },
      },
    ],
  };
  const { container, rerender } = render(
    <MemoryRouter>
      <AiMessageItem message={message} />
    </MemoryRouter>
  );
  const title = (outputId: string) =>
    container.querySelector(`[data-output-id="${outputId}"]`)!.firstElementChild!.textContent;
  expect(title('step-0')).toBe(
    i18n.t('pages.aiMemory.timeline.sourcesAdded', { added: 2, total: 5 })
  );
  const chineseTitle = title('step-0');
  await i18n.changeLanguage('en');
  rerender(
    <MemoryRouter>
      <AiMessageItem message={JSON.parse(JSON.stringify(message))} />
    </MemoryRouter>
  );
  expect(title('step-0')).toBe(
    i18n.t('pages.aiMemory.timeline.sourcesAdded', { added: 2, total: 5 })
  );
  expect(title('step-0')).not.toBe(chineseTitle);
  expect(title('step-1')).toBe(i18n.t('pages.aiMemory.timeline.phases.answering'));
});
