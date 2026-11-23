import type { APIRoute } from 'astro';
import { getAllProducts, getAllComparisons } from '../lib/content';
import { SITE } from '../data/site';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = () => {
  const products = getAllProducts();
  const comparisons = getAllComparisons();

  const items = [
    ...comparisons.map((c) => ({
      title: `HEG VS: ${c.title} (${c.hookBadge})`,
      link: `${SITE.url}/vs/${c.slug}`,
      description: c.tldr,
      pubDate: new Date(c.dateModified).toUTCString(),
    })),
    ...products.map((p) => ({
      title: `${p.name} — HEG Puanı ${p.hegScore}/10`,
      link: `${SITE.url}/urun/${p.slug}`,
      description: p.tldr,
      pubDate: new Date(p.dateModified).toUTCString(),
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE.name)}</title>
    <link>${SITE.url}</link>
    <description>${escapeXml(SITE.description)}</description>
    <language>tr-tr</language>
    <atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml" />
    ${items
      .map(
        (item) => `<item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid>${escapeXml(item.link)}</guid>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.pubDate}</pubDate>
    </item>`
      )
      .join('\n    ')}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
};
