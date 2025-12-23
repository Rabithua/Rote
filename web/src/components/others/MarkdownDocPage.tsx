import LanguageSwitcher from '@/components/others/languageSwitcher';
import Logo from '@/components/others/logo';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

// 预加载 doc 目录下的所有 Markdown 文件，按原始文本导入
const markdownFiles = import.meta.glob('/src/doc/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

type MarkdownDocPageProps = {
  // 根据语言代码（例如 zh / en / ja）返回对应 Markdown 文件的绝对路径（以 /src 开头）
  buildPath: (lang: string) => string;
  // 加载中文案，可选
  loadingText?: string;
};

function getMarkdown(buildPath: (lang: string) => string, lang: string): string {
  const short = lang.slice(0, 2);
  const path = buildPath(short);

  if (markdownFiles[path]) return markdownFiles[path];

  // 如果精确路径不存在，尝试按后缀匹配（更宽松一点）
  const suffix = path.replace(/^.*\/src\/doc\//, '');
  const fallbackEntry = Object.entries(markdownFiles).find(([p]) => p.endsWith(suffix));
  if (fallbackEntry) return fallbackEntry[1];

  // 最后退回到任意一个文档，避免完全空白
  const first = Object.values(markdownFiles)[0];
  return first || '';
}

function MarkdownDocPage({ buildPath, loadingText = 'Loading document...' }: MarkdownDocPageProps) {
  const { i18n } = useTranslation();
  const markdown = getMarkdown(buildPath, i18n.language);

  return (
    <div className="bg-background min-h-dvh font-sans">
      {/* Header */}
      <div className="bg-background/90 sticky top-0 z-10 w-full border-b px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Logo className="h-6 w-auto opacity-90" color="#07C160" />
            </Link>
          </div>
          <LanguageSwitcher />
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <article className="prose prose-neutral dark:prose-invert prose-li:break-all prose-code:text-foreground! prose-pre:bg-muted prose-pre:code:text-foreground! w-full overflow-hidden">
          {markdown ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          ) : (
            <p className="text-muted-foreground text-sm">{loadingText}</p>
          )}
        </article>
      </div>
    </div>
  );
}

export default MarkdownDocPage;
