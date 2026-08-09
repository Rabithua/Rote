import { cleanSourceText, getAiSourcePath } from '@/components/ai/AiSourceList';
import type { AiSemanticResult } from '@/utils/aiApi';
import { cjk } from '@streamdown/cjk';
import { type MouseEvent, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Streamdown } from 'streamdown';

interface AiStreamingMarkdownProps {
  content: string;
  isStreaming?: boolean;
  sources?: AiSemanticResult[];
}

/**
 * Replace bare citation markers such as `[N]` and `[N,M]` with markdown links
 * that point to the referenced sources. Only markers whose index falls within
 * the sources array are converted — others are left untouched.
 *
 * We deliberately skip `[N]` that are already part of a markdown link (e.g.
 * `[text](url)` or `[^N]`) to avoid double-linking.
 */
export function linkifyCitations(content: string, sources: AiSemanticResult[]): string {
  if (sources.length === 0) return content;

  const codePattern = /(`+|~{3,})[\s\S]*?\1/g;
  let result = '';
  let lastIndex = 0;

  for (const match of content.matchAll(codePattern)) {
    const matchIndex = match.index;
    result += linkifyCitationText(content.slice(lastIndex, matchIndex), sources);
    result += match[0];
    lastIndex = matchIndex + match[0].length;
  }

  return result + linkifyCitationText(content.slice(lastIndex), sources);
}

function linkifyCitationText(content: string, sources: AiSemanticResult[]): string {
  // Match [N] or comma-separated groups such as [N,M], but not markers
  // preceded by [ or followed by (, [, or ].
  // This avoids matching inside existing markdown links like [text](url)
  // or [text][label], and reference-style [^1] footnotes.
  return content.replace(/(?<!\[)\[(\d+(?:\s*[,，]\s*\d+)*)\](?![([\]])/g, (_, group) =>
    group
      .split(/(\s*[,，]\s*)/)
      .map((part: string) => {
        if (!/^\d+$/.test(part)) return part;

        const citation = linkifyCitation(part, sources);
        return citation || `[${part}]`;
      })
      .join('')
  );
}

function linkifyCitation(numStr: string, sources: AiSemanticResult[]): string | null {
  const index = parseInt(numStr, 10) - 1; // AI uses 1-indexed
  if (index < 0 || index >= sources.length) return null;
  const source = sources[index];
  const path = getAiSourcePath(source);
  const cleanText = source.preview || cleanSourceText(source.text || '');
  const title = (source.metadata?.title || cleanText.slice(0, 30)).replace(/\s+/g, ' ').trim();
  const escapedTitle = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `[\\[${numStr}\\]](${path} "${escapedTitle}")`;
}

function AiStreamingMarkdown({
  content,
  isStreaming = false,
  sources = [],
}: AiStreamingMarkdownProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const processedContent = useMemo(
    () => (isStreaming || sources.length === 0 ? content : linkifyCitations(content, sources)),
    [content, isStreaming, sources]
  );

  // Intercept clicks on internal links to use client-side navigation
  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Only intercept internal (same-origin) links
      if (href.startsWith('/')) {
        event.preventDefault();
        navigate(href);
      }
    },
    [navigate]
  );
  return (
    <div ref={containerRef} onClick={handleClick}>
      <Streamdown
        className="prose prose-neutral dark:prose-invert prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-pre:bg-muted prose-pre:text-foreground prose-code:wrap-break-word max-w-none text-sm leading-7 wrap-break-word"
        mode={isStreaming ? 'streaming' : 'static'}
        animated={false}
        isAnimating={false}
        plugins={{ cjk }}
        linkSafety={{ enabled: false }}
        controls={{
          code: { copy: true, download: false },
          table: { copy: true, download: false, fullscreen: false },
        }}
      >
        {processedContent}
      </Streamdown>
    </div>
  );
}

export default AiStreamingMarkdown;
