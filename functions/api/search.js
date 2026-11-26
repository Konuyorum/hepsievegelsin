/**
 * HEG (Hepsi Eve Gelsin) v2 — Hardened AI Product Analysis & VS Edge Function
 * Route: POST /api/search
 * Primary AI Engine: NVIDIA Developer NIM API (Nemotron 3.5 Lightning + Bolt fallback)
 *
 * Security & Scope Layers:
 *  1. Strict Origin + Referer allowlist (no wildcard CORS, blocks external sites & raw scripts)
 *  2. Sec-Fetch-Site same-origin enforcement + required custom X-HEG-Client header
 *  3. Per-IP sliding-window rate limiting (burst & hourly quotas)
 *  4. Brand/Product-name-only input enforcement (blocks general questions & non-shopping prompts)
 *  5. Structured Pros/Cons user-review table + Better Alternative (price, features, reviews)
 */

const ALLOWED_ORIGINS = new Set([
  'https://hepsievegelsin.com',
  'https://www.hepsievegelsin.com',
  'https://heg.pages.dev',
]);

const RATE_WINDOW_MS = 60_000;
const MAX_REQ_PER_MIN = 8;
const HOURLY_WINDOW_MS = 3_600_000;
const MAX_REQ_PER_HOUR = 30;
const ipHits = new Map();

const QUESTION_PATTERN =
  /[?¿]|(^|\s)(nasıl|neden|niçin|niye|nedir|kimdir|ne\s+zaman|nerede|nereye|hangisi|hangi|kaç\s+tane|kaç\s+lira|ne\s+kadar|tavsiye\s+eder|önerir\s+misin|alınır\s+mı|değer\s+mi|yazar\s+mısın|anlat|açıkla|hesapla|çevir|özetle|kod\s+yaz|merhaba|selam|naber|how|what|why|when|where|who|which)(\s|$)/i;

function isQuestionOrInvalidProduct(str) {
  if (!str) return true;
  if (QUESTION_PATTERN.test(str)) return true;
  const words = str.split(/\s+/).filter(Boolean);
  // Product / brand names should be concise (max 6 words)
  if (words.length > 6) return true;
  return false;
}

function isAllowedOrigin(origin, hostHeader) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.heg\.pages\.dev$/i.test(origin)) return true;

  const isLocalHost =
    hostHeader && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(hostHeader);
  if (isLocalHost && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return true;
  }
  return false;
}

function isAllowedReferer(referer, hostHeader) {
  if (!referer) return false;
  try {
    const refOrigin = new URL(referer).origin;
    return isAllowedOrigin(refOrigin, hostHeader);
  } catch {
    return false;
  }
}

function checkRateLimit(ip) {
  const now = Date.now();
  const timestamps = (ipHits.get(ip) || []).filter((ts) => now - ts < HOURLY_WINDOW_MS);

  const lastMinuteCount = timestamps.filter((ts) => now - ts < RATE_WINDOW_MS).length;
  if (lastMinuteCount >= MAX_REQ_PER_MIN) {
    ipHits.set(ip, timestamps);
    return { allowed: false, retryAfter: 60, reason: 'Dakikalık sorgu sınırına ulaştınız. Lütfen 1 dakika bekleyin.' };
  }

  if (timestamps.length >= MAX_REQ_PER_HOUR) {
    ipHits.set(ip, timestamps);
    return { allowed: false, retryAfter: 600, reason: 'Saatlik sorgu sınırına ulaştınız. Lütfen daha sonra tekrar deneyin.' };
  }

  timestamps.push(now);
  ipHits.set(ip, timestamps);

  if (ipHits.size > 2000) {
    const oldestKey = ipHits.keys().next().value;
    if (oldestKey) ipHits.delete(oldestKey);
  }
  return { allowed: true };
}

function buildSecurityHeaders(allowedOrigin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
    Vary: 'Origin',
  };
  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, X-HEG-Client';
  }
  return headers;
}

function sanitizeQuery(str) {
  return String(str || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[<>{}`$]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractJson(rawText) {
  if (!rawText) return null;
  const clean = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const match = clean.match(/(\{[\s\S]*\})/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

export async function onRequestOptions(context) {
  const { request } = context;
  const origin = request.headers.get('Origin') || '';
  const host = request.headers.get('Host') || '';
  if (!isAllowedOrigin(origin, host)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: buildSecurityHeaders(origin) });
}

export async function onRequestGet() {
  return new Response(JSON.stringify({ type: 'error', message: 'Method Not Allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  const host = request.headers.get('Host') || '';
  const clientHeader = request.headers.get('X-HEG-Client') || '';
  const fetchSite = request.headers.get('Sec-Fetch-Site') || '';

  const originOk = isAllowedOrigin(origin, host);
  const refererOk = isAllowedReferer(referer, host);
  const secFetchOk = !fetchSite || fetchSite === 'same-origin';

  if (!originOk || !refererOk || !secFetchOk || clientHeader !== 'web-v2') {
    return new Response(
      JSON.stringify({ type: 'error', message: 'Yetkisiz erişim engellendi.' }),
      { status: 403, headers: buildSecurityHeaders(null) }
    );
  }

  const headers = buildSecurityHeaders(origin);

  const clientIp =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown';
  const rate = checkRateLimit(clientIp);
  if (!rate.allowed) {
    return new Response(
      JSON.stringify({ type: 'error', message: rate.reason }),
      { status: 429, headers: { ...headers, 'Retry-After': String(rate.retryAfter) } }
    );
  }

  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 1024) {
    return new Response(
      JSON.stringify({ type: 'error', message: 'İstek boyutu sınırı aşıldı.' }),
      { status: 413, headers }
    );
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > 1024) {
      return new Response(
        JSON.stringify({ type: 'error', message: 'İstek boyutu sınırı aşıldı.' }),
        { status: 413, headers }
      );
    }

    const body = JSON.parse(rawBody);
    const query = sanitizeQuery(body.query);
    const query2 = sanitizeQuery(body.query2);
    const isVS = Boolean(body.isVS);

    if (!query || query.length < 2 || query.length > 60) {
      return new Response(
        JSON.stringify({
          type: 'error',
          message: 'Lütfen yalnızca marka ve ürün adı girin (Örn: Dyson V15 Detect, Roborock S8).',
        }),
        { status: 400, headers }
      );
    }

    // Strict brand/product-only rule: block questions & general sentences
    if (isQuestionOrInvalidProduct(query) || (isVS && isQuestionOrInvalidProduct(query2))) {
      return new Response(
        JSON.stringify({
          type: 'error',
          message:
            'AI Analiz alanına soru sorulamaz; yalnızca marka veya ürün adı girilebilir (Örn: Dyson V15 Detect, Roborock S8). Genel sorularınız için aşağıdaki Google Web Araştırması bölümünü kullanın.',
        }),
        { status: 400, headers }
      );
    }

    if (isVS && (!query2 || query2.length < 2 || query2.length > 60)) {
      return new Response(
        JSON.stringify({ type: 'error', message: 'VS modu için 2. marka/ürün adını da girin.' }),
        { status: 400, headers }
      );
    }

    const systemPrompt =
      'Sen Hepsi Eve Gelsin (hepsievegelsin.com) platformunun tarafsız, marka sponsorluğu almayan Türkiye e-ticaret ürün analiz uzmanısın. ' +
      'SADECE geçerli ham JSON döndür (markdown blokları veya ekstra açıklama yazma). ' +
      'Girdi yalnızca bir ürün veya marka adı olmalıdır. Eğer girdi bir soru, sohbet veya ürün/marka dışı bir ifadeyse ' +
      'SADECE şu JSON\'u döndür: {"type":"error","message":"AI Analiz yalnızca marka veya ürün adı içindir. Genel sorular için Google Web Araştırması bölümünü kullanın."}';

    let userPrompt = '';
    if (isVS) {
      userPrompt = `Türkiye piyasası gözüyle "${query}" ile "${query2}" ürünlerini gerçek kullanıcı yorumları, özellikler ve fiyat/performans açısından tarafsız karşılaştır.

KONTROL:
Kıyaslanabilir iki ürün değilse SADECE şu JSON'u döndür:
{"type":"error","message":"Karşılaştırma için benzer iki marka/model girin (Örn: Roborock S8 vs Dreame L10s Ultra)."}

Kıyaslanabilirse SADECE şu JSON'u döndür:
{
  "type": "comparison",
  "p1_name": "${query}",
  "p2_name": "${query2}",
  "summary": "İki ürün arasındaki kritik farkı ve hangisinin kime göre olduğunu anlatan 2-3 cümlelik tarafsız HEG kararı.",
  "table": [
    {"feature": "Kriter Adı", "val1": "Ürün 1 Değeri", "val2": "Ürün 2 Değeri", "winner": 1}
  ]
}`;
    } else {
      userPrompt = `Marka/Ürün: "${query}"

GÖREV:
Türkiye'deki (Hepsiburada, Amazon TR, Trendyol, global kullanıcı forumları) gerçek kullanıcı yorumlarını derleyerek bu ürün/marka için tarafsız bir **Pozitifler ve Negatifler tablosu** oluştur ve **fiyat, özellik ve kullanıcı yorumları açısından daha iyi bir alternatifi varsa** onu net şekilde öner.

SADECE şu ham JSON formatını döndür:
{
  "type": "single",
  "title": "${query} — Kullanıcı Yorumları & HEG Analizi",
  "heg_score": 8.2,
  "verdict_label": "ŞARTLI ALINIR",
  "verdict": "Gerçek kullanıcı yorumları ve fiyat/performans dengesine dayanan 2-3 cümlelik net, tarafsız HEG özeti.",
  "review_table": [
    {
      "topic": "Performans & Kalite",
      "positive": "Kullanıcıların en çok övdüğü somut olumlu deneyim",
      "negative": "Kullanıcıların en sık şikayet ettiği somut olumsuz nokta"
    },
    {
      "topic": "Fiyat & Değer Dengesi",
      "positive": "Fiyatını hak eden güçlü yönü",
      "negative": "Fiyat/maliyet veya aksesuar açısından eleştirilen yönü"
    },
    {
      "topic": "Kullanım & Ergonomi",
      "positive": "Günlük kullanımda memnuniyet yaratan detay",
      "negative": "Ağırlık, ses, boyut veya pratiklik şikayeti"
    },
    {
      "topic": "Dayanıklılık & Servis",
      "positive": "Uzun kullanım veya marka güvencesi artısı",
      "negative": "Kronik sorun, pil ömrü veya yedek parça uyarısı"
    }
  ],
  "alternative": {
    "has_better": true,
    "name": "Türkiye'de Satılan Daha Mantıklı Rakip Marka ve Tam Model",
    "reason": "Bu alternatifin neden daha mantıklı bir tercih olduğunun 1-2 cümlelik net özeti.",
    "price_advantage": "Fiyat açısından avantajı (ör. benzer performansı daha ulaşılabilir fiyata sunar)",
    "feature_advantage": "Özellik açısından üstünlüğü (ör. daha uzun pil / ek başlık / daha sessiz)",
    "review_advantage": "Kullanıcı yorumları açısından üstünlüğü (ör. daha az kronik arıza şikayeti)"
  },
  "amazon_keyword": "${query}"
}

Not: verdict_label yalnızca şunlardan biri olsun: "KESİN ALINIR", "EN İYİ F/P", "ŞARTLI ALINIR", "ALINMAZ".`;
    }

    let parsedData = null;

    // 1. Primary Engine: NVIDIA Developer NIM API (Nemotron 3.5 Lightning + Bolt fallback)
    if (env.NVIDIA_API_KEY) {
      const nvidiaModels = [
        env.NVIDIA_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b',
        'nvidia/nemotron-3.5-bolt-e4b',
      ];

      for (const model of nvidiaModels) {
        if (parsedData) break;
        try {
          const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(20_000),
            body: JSON.stringify({
              model,
              temperature: 0.2,
              top_p: 0.9,
              max_tokens: 1350,
              stream: false,
              chat_template_kwargs: { enable_thinking: false },
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
            }),
          });

          if (res.ok) {
            const data = await res.json();
            parsedData = extractJson(data?.choices?.[0]?.message?.content || '');
          } else {
            console.error(`NVIDIA NIM status (${model}):`, res.status);
          }
        } catch (err) {
          console.error(`NVIDIA NIM invocation error (${model}):`, err?.name || 'error');
        }
      }
    }

    // 2. Optional Fallback: Anthropic Claude
    if (!parsedData && env.ANTHROPIC_API_KEY) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          signal: AbortSignal.timeout(15_000),
          body: JSON.stringify({
            model: env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
            max_tokens: 1350,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });
        if (res.ok) {
          const data = await res.json();
          parsedData = extractJson(data?.content?.[0]?.text || '');
        }
      } catch (err) {
        console.error('Anthropic fallback error:', err?.name || 'error');
      }
    }

    if (!parsedData) {
      return new Response(
        JSON.stringify({
          type: 'error',
          message: 'Yapay zeka servisi şu an yanıt veremedi. Lütfen birkaç saniye sonra tekrar deneyin.',
        }),
        { status: 503, headers }
      );
    }

    return new Response(JSON.stringify(parsedData), { status: 200, headers });
  } catch (e) {
    console.error('HEG /api/search error:', e?.name || 'error');
    return new Response(
      JSON.stringify({
        type: 'error',
        message: 'Geçersiz istek veya geçici bağlantı hatası. Lütfen tekrar deneyin.',
      }),
      { status: 400, headers }
    );
  }
}
