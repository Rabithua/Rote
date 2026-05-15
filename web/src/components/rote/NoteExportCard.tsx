import { useEffect } from 'react';
import type { Attachment } from '@/types/main';

interface NoteExportCardProps {
  title?: string;
  content: string;
  noteId?: string;
  tags?: string[];
  attachments?: Attachment[];
  articleTitle?: string;
  author?: {
    nickname?: string;
    avatar?: string;
    username?: string;
  };
  onReady?: () => void;
}

export default function NoteExportCard({
  title,
  content,
  noteId,
  tags,
  attachments,
  articleTitle,
  author,
  onReady,
}: NoteExportCardProps) {
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => onReady?.());
    });
  }, [onReady]);

  const imageAttachments = attachments?.filter(
    (a) => a.details?.mediaKind === 'image' || (!a.details?.mediaKind && a.url)
  );

  return (
    <div
      style={{
        width: 720,
        background: '#ffffff',
        padding: '40px 48px',
        fontFamily: '"Noto Serif SC", "Optima-Regular", "PingFangSC-light", "Heiti SC", sans-serif',
        color: '#1a1a1a',
        overflow: 'visible',
      }}
    >
      {title && (
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 24,
            lineHeight: 1.3,
            color: '#000',
          }}
        >
          {title}
        </h1>
      )}
      {title && <hr style={{ border: 'none', borderTop: '1px solid #e5e5e5', marginBottom: 24 }} />}
      {content && (
        <div
          style={{
            fontSize: 16,
            lineHeight: 1.75,
            color: '#333',
            whiteSpace: 'pre-line',
            wordBreak: 'break-word',
          }}
        >
          {content}
        </div>
      )}

      {/* Article reference */}
      {articleTitle && (
        <div
          style={{
            marginTop: 20,
            padding: '12px 16px',
            border: '1px solid #e5e5e5',
            borderRadius: 8,
            fontSize: 14,
            color: '#555',
          }}
        >
          <span style={{ color: '#888', fontSize: 12 }}>Article</span>
          <div style={{ marginTop: 4, fontWeight: 600, color: '#1a1a1a' }}>{articleTitle}</div>
        </div>
      )}

      {/* Image attachments */}
      {imageAttachments && imageAttachments.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 3,
            marginTop: 20,
            borderRadius: 16,
            overflow: 'hidden',
            width: 'fit-content',
          }}
        >
          {imageAttachments.map((att) => {
            const count = imageAttachments.length;
            const imgStyle: React.CSSProperties = {
              objectFit: 'cover',
              display: 'block',
              background: '#f5f5f5',
            };
            if (count === 1) {
              Object.assign(imgStyle, { width: 500, borderRadius: 16 });
            } else if (count === 2) {
              Object.assign(imgStyle, {
                width: 'calc(1/2 * 100% - 2px)',
                aspectRatio: '1 / 1',
              });
            } else {
              Object.assign(imgStyle, {
                width: count % 3 === 0 ? 'calc(1/3 * 100% - 2px)' : 'calc(1/3 * 100% - 2px)',
                aspectRatio: '1 / 1',
              });
            }
            return <img key={att.id} src={att.compressUrl || att.url} alt="" style={imgStyle} />;
          })}
        </div>
      )}

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 24 }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 12,
                color: '#666',
                background: '#f5f5f5',
                borderRadius: 4,
                padding: '2px 8px',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <hr
        style={{ border: 'none', borderTop: '1px solid #e5e5e5', marginTop: 32, marginBottom: 16 }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 13,
          color: '#888',
        }}
      >
        {author && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img
              src={author.avatar || '/DefaultAvatar.svg'}
              alt=""
              crossOrigin="anonymous"
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                objectFit: 'cover',
                border: '1px solid #e5e5e5',
              }}
            />
            <span style={{ color: '#555' }}>
              {noteId
                ? `${window.location.origin}/rote/${noteId}`
                : `${window.location.origin}/${author.username}`}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src="/ico.svg" alt="Rote" style={{ width: 16, height: 16 }} />
          <span style={{ fontWeight: 600, color: '#07C160' }}>Rote</span>
        </div>
      </div>
    </div>
  );
}
