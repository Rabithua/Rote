import type { LinkPreview } from '@/types/main';
import { ArrowUpRight, Link } from 'lucide-react';
import { useMemo } from 'react';

export function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
  const host = useMemo(() => {
    try {
      return new URL(preview.url).hostname.replace(/^www\./, '');
    } catch {
      return preview.url;
    }
  }, [preview.url]);

  const title = preview.title || host;
  const description = preview.description || preview.contentExcerpt || '';

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group hover:bg-secondary bg-secondary/50 flex cursor-pointer items-stretch overflow-hidden rounded-md border duration-300"
    >
      <div className="bg-foreground/5 flex size-18 shrink-0 items-center justify-center">
        {preview.image ? (
          <img
            src={preview.image}
            alt=""
            className="size-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="text-primary flex size-full items-center justify-center">
            <Link className="size-6" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-1.5">
        <div className="truncate text-sm font-semibold">{title}</div>
        {description && (
          <div className="text-muted-foreground line-clamp-1 text-xs font-light">{description}</div>
        )}
        <div className="text-muted-foreground group-hover:text-theme flex items-center gap-1 truncate text-xs">
          {host}
          <ArrowUpRight className="size-3" />
        </div>
      </div>
    </a>
  );
}
