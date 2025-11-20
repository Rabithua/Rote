export type ChangeFrequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

export interface SitemapUrlEntry {
  loc: string;
  lastmod?: string;
  changefreq?: ChangeFrequency;
  priority?: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateSitemapXML(urls: SitemapUrlEntry[]): string {
  const header = '<?xml version="1.0" encoding="UTF-8"?>';
  const urlsetOpen = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  const urlsetClose = '</urlset>';

  const urlEntries = urls.map((url) => {
    const parts: string[] = [`  <url>`, `    <loc>${escapeXml(url.loc)}</loc>`];

    if (url.lastmod) {
      parts.push(`    <lastmod>${escapeXml(url.lastmod)}</lastmod>`);
    }

    if (url.changefreq) {
      parts.push(`    <changefreq>${url.changefreq}</changefreq>`);
    }

    if (typeof url.priority === 'number') {
      const priority = Math.max(0, Math.min(url.priority, 1)).toFixed(1);
      parts.push(`    <priority>${priority}</priority>`);
    }

    parts.push(`  </url>`);
    return parts.join('\n');
  });

  return [header, urlsetOpen, ...urlEntries, urlsetClose].join('\n');
}
