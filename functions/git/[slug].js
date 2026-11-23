/**
 * HEG (Hepsi Eve Gelsin) — Immortal Affiliate Redirect Engine
 * Route: GET /git/:slug
 * Performs fast edge 302 redirects from centralized links.json so YouTube/Instagram links never die.
 */
import links from '../../src/data/links.json';

export async function onRequestGet(context) {
  const slug = context.params.slug;
  const entry = links[slug];

  if (entry && entry.url) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: entry.url,
        'Cache-Control': 'no-cache, max-age=0',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/urunler',
    },
  });
}
