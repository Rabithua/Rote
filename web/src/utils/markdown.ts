// 封面图提取：复用 markdownParser.ts 的实现
export { extractFirstImageFromMarkdown } from './markdownParser';
// 从 Markdown content 中解析标题和摘要

function stripMarkdownInline(text: string): string {
  // 去除行内 Markdown 标记: **__~~`[]()! 等
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

// 从 Markdown 内容中提取标题
export function extractTitleFromMarkdown(content: string): string {
  const lines = content.split(/\r?\n/);
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
  return '无标题';
}

// 从 Markdown 内容中提取摘要
export function extractSummaryFromMarkdown(content: string): string {
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

// 解析 Markdown 内容的 title 和 summary
export function parseMarkdownMeta(content: string): { title: string; summary: string } {
  const title = extractTitleFromMarkdown(content);
  const summary = extractSummaryFromMarkdown(content);
  return { title, summary };
}
