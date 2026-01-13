/**
 * 从Markdown内容中提取第一张图片的URL
 * 规则：匹配第一个 ![alt](url) 语法，返回 url
 * @param content Markdown内容
 * @returns 图片URL或null
 */
/**
 * 提取 Markdown 首张图片 URL，兼容行首有空白符、列表符号等
 * @param content Markdown内容
 * @returns 图片URL或null
 */
export function extractFirstImageFromMarkdown(content: string): string | null {
  if (!content) return null;
  const lines = content.split(/\r?\n/);
  // 支持行首有空格、tab、-、*、> 等
  const imageRegex = /^[\s>*-]*!\[[^\]]*\]\(([^)]+)\)/;
  for (const raw of lines) {
    const match = raw.match(imageRegex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}
/**
 * 从Markdown内容中提取标题和摘要
 * 规则与后端保持一致，确保前后端解析结果相同
 */

/**
 * 去除行内Markdown标记：**__~~`[]()! 等
 * 与后端 stripMarkdownInline 逻辑一致
 */
function stripMarkdownInline(text: string): string {
  return text
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // 行内代码
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 图片
    .replace(/\[[^\]]*\]\([^)]*\)/g, '') // 链接
    .replace(/[_*]{1,3}([^*_]+)[_*]{1,3}/g, '$1') // 粗体/斜体
    .replace(/~~([^~]+)~~/g, '$1') // 删除线
    .replace(/^>\s?/g, '') // 引用前缀
    .replace(/[#\-*>\s]+/g, ' ') // 符号归并为空格
    .replace(/\s+/g, ' ') // 多空格归并
    .trim();
}

/**
 * 从Markdown内容中提取第一个一级标题作为标题
 * 规则：取第一个 `# ` 开头的行；若无则取第一段非空文本的前80字符
 * @param content Markdown内容
 * @returns 提取的标题
 */
export function extractTitleFromMarkdown(content: string): string {
  if (!content) return 'Untitled';

  const lines = content.split(/\r?\n/);
  // 查找第一个一级标题
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('# ')) {
      const t = stripMarkdownInline(line.replace(/^#\s+/, ''));
      if (t) return t.slice(0, 200);
    }
  }
  // 退化到第一段非空文本
  for (const raw of lines) {
    const t = stripMarkdownInline(raw.trim());
    if (t) return t.slice(0, 80);
  }
  return 'Untitled';
}

/**
 * 从Markdown内容中提取摘要
 * 规则：跳过标题、代码块、图片行，取第一段有效文字截断到150字符
 * @param content Markdown内容
 * @returns 提取的摘要
 */
export function extractSummaryFromMarkdown(content: string): string {
  if (!content) return '';

  const lines = content.split(/\r?\n/);
  let inCodeBlock = false;

  for (const raw of lines) {
    const line = raw.trim();

    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;
    if (!line) continue;
    if (line.startsWith('#')) continue; // 跳过标题
    if (/^!\[[^\]]*\]\([^)]*\)/.test(line)) continue; // 跳过仅图片行

    const t = stripMarkdownInline(line);
    if (t) return t.slice(0, 150);
  }

  return '';
}

/**
 * 从Markdown内容中同时提取标题和摘要
 * @param content Markdown内容
 * @returns 包含标题和摘要的对象
 */
export function parseMarkdownMeta(content: string): {
  title: string;
  summary: string;
} {
  return {
    title: extractTitleFromMarkdown(content),
    summary: extractSummaryFromMarkdown(content),
  };
}
