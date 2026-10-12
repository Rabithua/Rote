import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import AiStreamingMarkdown from './AiStreamingMarkdown';

vi.unmock('react-dom/client');

afterEach(cleanup);

function CurrentPath() {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname}</output>;
}

it('renders each adjacent citation as a working source link when the reply finishes', () => {
  const sources = Array.from({ length: 30 }, (_, index) => ({
    sourceType: 'rote' as const,
    sourceId: `rote-${index + 1}`,
    similarity: 1,
    text: `Source ${index + 1}`,
    metadata: {},
  }));
  const content = 'Answer [3][9][6]. More [30][10][15].';
  const reply = (isStreaming: boolean) => (
    <MemoryRouter initialEntries={['/ai']}>
      <AiStreamingMarkdown content={content} sources={sources} isStreaming={isStreaming} />
      <CurrentPath />
    </MemoryRouter>
  );
  const { rerender } = render(reply(true));

  expect(screen.queryAllByRole('link')).toHaveLength(0);
  rerender(reply(false));

  const links = screen.getAllByRole('link');
  expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
    ['[3]', '/rote/rote-3'],
    ['[9]', '/rote/rote-9'],
    ['[6]', '/rote/rote-6'],
    ['[30]', '/rote/rote-30'],
    ['[10]', '/rote/rote-10'],
    ['[15]', '/rote/rote-15'],
  ]);

  for (const link of links) {
    fireEvent.click(link);
    expect(screen.getByTestId('current-path')).toHaveTextContent(link.getAttribute('href')!);
  }
});
