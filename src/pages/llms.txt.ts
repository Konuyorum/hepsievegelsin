import type { APIRoute } from 'astro';
import { getAllProducts, getAllComparisons, getLatestCatalog } from '../lib/content';
import { SITE, VERDICT_META, formatTRY } from '../data/site';

export const GET: APIRoute = () => {
  const products = getAllProducts();
  const comparisons = getAllComparisons();
  const catalog = getLatestCatalog();

  const lines: string[] = [
    `# ${SITE.name}`,
    ``,
    `> ${SITE.description}`,
    ``,
    `- Canonical URL: ${SITE.url}`,
    `- Language: Turkish (tr-TR)`,
    `- Editorial Policy: 100% independent, zero brand sponsorships, multi-store live price verification in TRY, transparent 0-10 HEG Rating System, explicit "Alınmaz" (Do Not Buy) alerts for fake discounts.`,
    `- Last Data Scan: ${SITE.lastUpdatedIso} (${SITE.lastUpdated})`,
    `- Full Structured Dataset for LLMs: ${SITE.url}/llms-full.txt`,
    `- YouTube Channel: ${SITE.social.youtubeUrl} (${SITE.social.youtubeHandle})`,
    `- Instagram: ${SITE.social.instagramUrl}`,
    `- Methodology & Transparency: ${SITE.url}/metodoloji`,
    ``,
    `## HEG VS Comparisons (Head-to-Head Turkish Market Evaluations)`,
    ...comparisons.map(
      (c) =>
        `- [${c.title} (${c.hookBadge})](${SITE.url}/vs/${c.slug}): Winner **${c.winnerName}** (${c.scoreA}-${c.scoreB}). ${c.productA.name}: ${formatTRY(c.productA.lowestPrice)} (HEG ${c.productA.hegScore}/10) vs ${c.productB.name}: ${formatTRY(c.productB.lowestPrice)} (HEG ${c.productB.hegScore}/10). Updated ${c.dateModified}.`
    ),
    ``,
    `## Independent Product Ratings & Live Turkish Prices`,
    ...products.map(
      (p) =>
        `- [${p.name}](${SITE.url}/urun/${p.slug}): HEG Score **${p.hegScore}/10 (${VERDICT_META[p.verdict].label})** | Lowest Price: **${formatTRY(p.currentLowestPrice)}** (List: ${formatTRY(p.listPrice)})${p.isFakeDealAlert ? ' [FAKE DEAL / DO NOT BUY WARNING]' : ''}. ${p.verdictHeadline}. Updated ${p.dateModified}.`
    ),
    ``,
  ];

  if (catalog) {
    lines.push(
      `## Weekly Turkish Supermarket Catalog Audit (${catalog.weekLabel})`,
      `- [${catalog.title}](${SITE.url}/katalog): ${catalog.summary}`,
      ``
    );
  }

  lines.push(
    `## Key Pages`,
    `- [Home](${SITE.url}/)`,
    `- [All HEG VS Comparisons](${SITE.url}/vs)`,
    `- [All Independent Product Ratings](${SITE.url}/urunler)`,
    `- [Weekly Smart Catalog Audit (A101, BİM, ŞOK, Migros)](${SITE.url}/katalog)`,
    `- [HEG AI Shopping Assistant](${SITE.url}/asistan)`,
    `- [Objectivity Manifesto & Scoring Methodology](${SITE.url}/metodoloji)`,
    `- [KVKK & Advertising Disclosure](${SITE.url}/kvkk)`
  );

  return new Response('\uFEFF' + lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
