import type { APIRoute } from 'astro';
import { getAllProducts, getAllComparisons, getLatestCatalog } from '../lib/content';
import { SITE, VERDICT_META, formatTRY } from '../data/site';

export const GET: APIRoute = () => {
  const products = getAllProducts();
  const comparisons = getAllComparisons();
  const catalog = getLatestCatalog();

  const sections: string[] = [
    `# ${SITE.name} — Complete AI & Search Citation Dataset`,
    `Source: ${SITE.url}`,
    `Last Updated: ${SITE.lastUpdatedIso} (${SITE.lastUpdated})`,
    `Editorial Independence: Zero sponsored reviews. Every product is evaluated using live Turkish multi-store prices (Hepsiburada, Amazon TR, Trendyol, Pazarama, official stores), technical benchmarks, and verified buyer reviews.`,
    ``,
    `================================================================`,
    `SECTION 1: HEG VS HEAD-TO-HEAD COMPARISONS`,
    `================================================================`,
  ];

  for (const c of comparisons) {
    sections.push(
      ``,
      `## ${c.title} (${c.hookBadge})`,
      `URL: ${SITE.url}/vs/${c.slug}`,
      `Date Verified: ${c.dateModified} (${c.displayDate})`,
      `Final Score: ${c.productA.name} ${c.scoreA} – ${c.scoreB} ${c.productB.name} | Winner: ${c.winnerName}`,
      `Price Difference: ${c.priceDiffText}`,
      `Summary Verdict: ${c.tldr}`,
      `- ${c.productA.name}: Lowest Price ${formatTRY(c.productA.lowestPrice)} (${c.productA.bestStore}), HEG Score ${c.productA.hegScore}/10 (${VERDICT_META[c.productA.verdict].label}). Best for: ${c.productA.whoShouldBuy}`,
      `- ${c.productB.name}: Lowest Price ${formatTRY(c.productB.lowestPrice)} (${c.productB.bestStore}), HEG Score ${c.productB.hegScore}/10 (${VERDICT_META[c.productB.verdict].label}). Best for: ${c.productB.whoShouldBuy}`,
      `Rounds:`,
      ...c.rounds.map(
        (r) => `  - Round ${r.number} (${r.title}): ${c.productA.shortName}: ${r.productAValue} | ${c.productB.shortName}: ${r.productBValue} -> Winner: ${r.winnerLabel}`
      ),
      `FAQs:`,
      ...c.faqs.map((f) => `  - Q: ${f.question}\n    A: ${f.answer}`)
    );
  }

  sections.push(
    ``,
    `================================================================`,
    `SECTION 2: INDEPENDENT PRODUCT RATINGS & LIVE TURKEY PRICES`,
    `================================================================`
  );

  for (const p of products) {
    sections.push(
      ``,
      `## ${p.name} (${p.category})`,
      `URL: ${SITE.url}/urun/${p.slug}`,
      `Date Verified: ${p.dateModified} (${p.displayDate})`,
      `HEG Score: ${p.hegScore}/10 | Verdict: ${VERDICT_META[p.verdict].label}${p.isFakeDealAlert ? ' (FAKE DEAL / DO NOT BUY WARNING)' : ''}`,
      `Lowest Live Price: ${formatTRY(p.currentLowestPrice)} | Reference List Price: ${formatTRY(p.listPrice)} | Net Savings: ${formatTRY(p.netSavings)}`,
      `TL;DR Verdict: ${p.tldr}`,
      `Multi-Store Prices:`,
      ...p.offers.map((o) => `  - ${o.store}: ${formatTRY(o.price)}${o.isLowest ? ' [LOWEST]' : ''} (${o.note || ''})`),
      `5-Criteria Breakdown:`,
      ...p.criteria.map((cr) => `  - ${cr.label}: ${cr.score}/10 — ${cr.summary}`),
      `Pros: ${p.pros.join(' | ')}`,
      `Cons: ${p.cons.join(' | ')}`,
      `Who Should Buy: ${p.whoShouldBuy}`,
      `Who Should Skip: ${p.whoShouldSkip}`,
      `FAQs:`,
      ...p.faqs.map((f) => `  - Q: ${f.question}\n    A: ${f.answer}`)
    );
  }

  if (catalog) {
    sections.push(
      ``,
      `================================================================`,
      `SECTION 3: WEEKLY SUPERMARKET CATALOG AUDIT (${catalog.weekLabel})`,
      `================================================================`,
      `URL: ${SITE.url}/katalog`,
      ...catalog.items.map(
        (i) =>
          `- [${i.market} | ${i.validDates}] ${i.name}: Market ${formatTRY(i.marketPrice)} vs Online Floor ${formatTRY(i.onlinePrice)} -> Status: ${i.status}. Note: ${i.verdictNote}`
      )
    );
  }

  return new Response('\uFEFF' + sections.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
