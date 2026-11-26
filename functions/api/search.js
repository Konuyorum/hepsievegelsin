/**
 * HEG (Hepsi Eve Gelsin) v2 — Hardened AI Product & Category Analysis Edge Function
 * Route: POST /api/search
 * Primary AI Engine: NVIDIA Nemotron 3 Ultra (550B — nvidia/nemotron-3-ultra-550b-a55b)
 * Grounding: Verified HEG 2026 Turkish Catalog + Optional Live Web Price Search (Tavily / Serper)
 */

import prodFold8 from '../../src/content/products/samsung-galaxy-z-fold-8.json' with { type: 'json' };
import prodRoborock from '../../src/content/products/roborock-s8.json' with { type: 'json' };
import prodLiberty from '../../src/content/products/anker-soundcore-liberty-4-nc.json' with { type: 'json' };
import prodAirpods from '../../src/content/products/apple-airpods-4-standart.json' with { type: 'json' };
import compFoldDuo from '../../src/content/comparisons/galaxy-z-fold-8-vs-iphone-duo.json' with { type: 'json' };
import compRoboDreame from '../../src/content/comparisons/roborock-s8-vs-dreame-l10s-ultra.json' with { type: 'json' };

const VERIFIED_PRODUCTS = [prodFold8, prodRoborock, prodLiberty, prodAirpods];
const VERIFIED_COMPARISONS = [compFoldDuo, compRoboDreame];

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

function findVerifiedHegContext(queryText) {
  const norm = queryText.toLowerCase();
  const tokens = norm.split(/\s+/).filter((w) => w.length > 1);
  const notes = [];

  for (const p of VERIFIED_PRODUCTS) {
    const hay = `${p.name} ${p.brand} ${p.category} ${p.subtitle}`.toLowerCase();
    const matched = hay.includes(norm) || (tokens.length > 0 && tokens.every((t) => hay.includes(t)));
    if (matched) {
      const prices = p.offers.map((o) => o.price);
      const minP = Math.min(...prices).toLocaleString('tr-TR');
      const maxP = Math.max(...prices).toLocaleString('tr-TR');
      notes.push(
        `[HEG DOĞRULANMIŞ 2026 VERİSİ — ${p.displayDate}] Ürün: ${p.name} (${p.brand} · ${p.category}). ` +
          `Canlı Türkiye Fiyat Aralığı: ${minP} TL – ${maxP} TL (En düşük: ${p.currentLowestPrice.toLocaleString('tr-TR')} TL). ` +
          `HEG Puanı: ${p.hegScore}/10. Özet: ${p.tldr} ` +
          `Özellikler: ${p.specs.map((s) => `${s.label}: ${s.value}`).join(' | ')}. ` +
          `Artılar: ${p.pros.join('; ')}. Eksiler: ${p.cons.join('; ')}.`
      );
    }
  }

  for (const c of VERIFIED_COMPARISONS) {
    const hay = `${c.title} ${c.productA.name} ${c.productB.name}`.toLowerCase();
    const matched = hay.includes(norm) || (tokens.length > 0 && tokens.every((t) => hay.includes(t)));
    if (matched) {
      notes.push(
        `[HEG DOĞRULANMIŞ VS 2026 — ${c.displayDate}] ${c.title}: ` +
          `${c.productA.name} (${c.productA.lowestPrice.toLocaleString('tr-TR')} TL, HEG ${c.productA.hegScore}/10) vs ` +
          `${c.productB.name} (${c.productB.lowestPrice.toLocaleString('tr-TR')} TL, HEG ${c.productB.hegScore}/10). ` +
          `Özet: ${c.tldr}`
      );
    }
  }

  return notes.join('\n');
}

async function fetchLiveWebGrounding(query, env) {
  const searchQuery = `${query} Türkiye fiyat yorumları 2026`;

  // Option A: Serper.dev (Google Search JSON API — 2,500 free queries)
  if (env.SERPER_API_KEY) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': env.SERPER_API_KEY,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5_000),
        body: JSON.stringify({ q: searchQuery, gl: 'tr', hl: 'tr', num: 5 }),
      });
      if (res.ok) {
        const data = await res.json();
        const snippets = (data.organic || [])
          .slice(0, 5)
          .map((r) => `- ${r.title}: ${r.snippet || ''}`)
          .join('\n');
        if (snippets) return { source: 'canli_google', text: snippets };
      }
    } catch (e) {
      console.error('Serper grounding error:', e?.name || 'error');
    }
  }

  // Option B: Tavily Search API (1,000 free searches/month)
  if (env.TAVILY_API_KEY) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5_000),
        body: JSON.stringify({
          api_key: env.TAVILY_API_KEY,
          query: searchQuery,
          search_depth: 'basic',
          max_results: 5,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const snippets = (data.results || [])
          .slice(0, 5)
          .map((r) => `- ${r.title}: ${(r.content || '').slice(0, 220)}`)
          .join('\n');
        if (snippets) return { source: 'canli_web', text: snippets };
      }
    } catch (e) {
      console.error('Tavily grounding error:', e?.name || 'error');
    }
  }

  return null;
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
  if (contentLength > 1536) {
    return new Response(
      JSON.stringify({ type: 'error', message: 'İstek boyutu sınırı aşıldı.' }),
      { status: 413, headers }
    );
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > 1536) {
      return new Response(
        JSON.stringify({ type: 'error', message: 'İstek boyutu sınırı aşıldı.' }),
        { status: 413, headers }
      );
    }

    const body = JSON.parse(rawBody);
    const query = sanitizeQuery(body.query);
    const query2 = sanitizeQuery(body.query2);
    const isVS = Boolean(body.isVS);
    const rawFilters = Array.isArray(body.filters) ? body.filters : [];
    const filters = rawFilters
      .slice(0, 4)
      .map((f) => sanitizeQuery(f))
      .filter((f) => f.length >= 2 && f.length <= 45);

    if (!query || query.length < 2 || query.length > 60) {
      return new Response(
        JSON.stringify({
          type: 'error',
          message: 'Lütfen yalnızca marka, ürün veya kategori adı girin (Örn: Dyson V15 Detect, Z Fold 8, monitör).',
        }),
        { status: 400, headers }
      );
    }

    if (isQuestionOrInvalidProduct(query) || (isVS && isQuestionOrInvalidProduct(query2))) {
      return new Response(
        JSON.stringify({
          type: 'error',
          message:
            'AI Analiz alanına soru sorulamaz; yalnızca marka, ürün veya kategori adı girilebilir (Örn: Dyson V15 Detect, Z Fold 8, monitör). Genel sorularınız için aşağıdaki Google Web Araştırması bölümünü kullanın.',
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

    // Gather Grounding Context (Verified HEG 2026 DB + Optional Live Web Search)
    const verifiedContext = findVerifiedHegContext(isVS ? `${query} ${query2}` : query);
    const liveWeb = await fetchLiveWebGrounding(isVS ? `${query} vs ${query2}` : query, env);

    const groundingBlock = [
      verifiedContext ? `DOĞRULANMIŞ HEG 2026 VERİTABANI (BU VERİLERİ KESİN KAYNAK OLARAK KULLAN):\n${verifiedContext}` : '',
      liveWeb ? `ANLIK CANLI WEB & FİYAT SONUÇLARI:\n${liveWeb.text}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const priceStatusLabel =
      verifiedContext || liveWeb ? 'Canlı Doğrulanmış Fiyat Aralığı' : 'Türkiye Piyasa Fiyat Aralığı (2026)';

    const systemPrompt =
      'Sen Hepsi Eve Gelsin (hepsievegelsin.com) platformunun kıdemli, tarafsız ve marka sponsorluğu almayan Türkiye e-ticaret ürün analiz uzmanısın. ' +
      'Bugünün tarihi Kasım 2026\'dır. Kusursuz, doğal ve akıcı Türkiye Türkçesi kullan; uydurma kelime veya bozuk çeviri asla kullanma. ' +
      'SADECE geçerli ham JSON döndür (markdown blokları veya ekstra açıklama yazma). ' +
      'KRİTİK KURALLAR:\n' +
      '1. Kullanıcı "Z Fold 8" gibi spesifik bir model arattığında ASLA eski bir modele (ör. Z Fold 5) dönüştürme! Doğrulanmış HEG 2026 verisi veya canlı web sonucu verilmişse doğrudan o verileri kullan.\n' +
      '2. Kullanıcı "Bosch 9" veya "Watch 9" gibi birden fazla marka/seriye işaret edebilen eksik bir ifade girerse, tahmini tek bir alakasız markaya atlama — "category_guided" modunda gerçek olası marka+modelleri (ör. Bosch Unlimited 9 Dikey Süpürge, Bosch Serie 8/9 Çamaşır Makinesi vb.) net marka adlarıyla listele!\n' +
      '3. Her analizde ve her alternatif önerisinde gerçek MARKA + TAM MODEL + TÜRKİYE FİYAT ARALIĞI (TL cinsinden) mutlaka yer alsın.\n' +
      '4. Alışveriş/ürün/kategori dışı ifadelerde SADECE şunu döndür: {"type":"error","message":"AI Analiz yalnızca marka, ürün veya kategori adı içindir. Genel sorular için Google Web Araştırması bölümünü kullanın."}';

    let userPrompt = '';
    if (isVS) {
      userPrompt = `${groundingBlock ? groundingBlock + '\n\n' : ''}Türkiye piyasası gözüyle "${query}" ile "${query2}" ürünlerini detaylı teknik özellikler, gerçek kullanıcı yorumları ve Türkiye fiyat aralığı açısından tarafsız karşılaştır.

Kıyaslanabilir iki ürün değilse SADECE:
{"type":"error","message":"Karşılaştırma için benzer iki spesifik marka ve model girin (Örn: Roborock S8 vs Dreame L10s Ultra)."}

Kıyaslanabilirse SADECE şu JSON şemasını döndür:
{
  "type": "comparison",
  "p1_name": "Tam Marka ve Model 1",
  "p1_price_range": "Örn: 100.449 TL – 131.999 TL",
  "p2_name": "Tam Marka ve Model 2",
  "p2_price_range": "Örn: 229.999 TL – 246.999 TL",
  "summary": "İki ürün arasındaki temel farkı, fiyat/performans kazananını ve kimin hangisini alması gerektiğini anlatan 3 cümlelik tarafsız HEG kararı.",
  "table": [
    {"feature": "Kriter Adı", "val1": "Ürün 1 Değeri", "val2": "Ürün 2 Değeri", "winner": 1}
  ]
}`;
    } else {
      const filterClause =
        filters.length > 0
          ? `\nKULLANICININ SEÇTİĞİ FİLTRELER: ${filters.join(', ')} — Önerdiğin 4 gerçek marka/model KESİNLİKLE bu kriterlere birebir uysun!`
          : '';

      userPrompt = `${groundingBlock ? groundingBlock + '\n\n' : ''}Kullanıcı Girdisi: "${query}"${filterClause}

AKILLI YOL AYRIMI (ZORUNLU):

DURUM 1 — GENEL KATEGORİ veya BELİRSİZ/EKSİK SERİ İSE:
(Örn: "monitör", "ayakkabı", "kulaklık", "telefon", "laptop", "airfryer", "robot süpürge", "kahve makinesi", "Adidas", "Bosch 9", "Watch 9" gibi tek bir kesin tam modele işaret etmeyen sorgular veya filtreli kategori aramaları)
-> KESİNLİKLE "category_guided" tipinde JSON döndür!
-> Kullanıcıya seçimini netleştirmesi için 2-3 kısa soru ve tıklanabilir seçenekler sun.
-> Türkiye'de satılan **4 adet GERÇEK MARKA + TAM MODEL** listele; her birinin **Türkiye fiyat aralığı (price_range_try)**, HEG puanı, detaylı 1-2 cümlelik özeti, 2 somut pozitif ve 2 somut negatif kullanıcı yorumu olsun!

"category_guided" JSON ŞEMASI:
{
  "type": "category_guided",
  "category_title": "${query} — En İyi 4 Gerçek Model & Seçim Rehberi",
  "intro": "Kullanım amacınıza göre filtre seçebilir veya Türkiye'de en çok tercih edilen 4 gerçek modeli fiyat aralıkları ve yorumlarıyla karşılaştırabilirsiniz.",
  "price_source_note": "${priceStatusLabel}",
  "applied_filters": ${JSON.stringify(filters)},
  "clarify_questions": [
    {"question": "Kullanım amacınız nedir?", "options": ["Seçenek 1", "Seçenek 2", "Seçenek 3", "Seçenek 4"]},
    {"question": "Boyut / Tür tercihiniz?", "options": ["Seçenek A", "Seçenek B", "Seçenek C"]}
  ],
  "items": [
    {
      "brand": "Gerçek Marka",
      "model": "Tam Model Adı",
      "price_range_try": "Örn: 8.500 TL – 10.200 TL",
      "tag": "En İyi F/P",
      "heg_score": 8.9,
      "summary": "Bu modelin öne çıkan teknik gücünü ve kime hitap ettiğini anlatan 1-2 net cümle",
      "positives": ["Somut olumlu kullanıcı yorumu 1", "Somut olumlu kullanıcı yorumu 2"],
      "negatives": ["Somut olumsuz kullanıcı yorumu 1", "Somut olumsuz kullanıcı yorumu 2"],
      "search_keyword": "Marka Tam Model"
    }
  ]
}

DURUM 2 — KESİN, TEK BİR SPESİFİK MARKA + TAM MODEL İSE:
(Örn: "Samsung Galaxy Z Fold 8", "Z Fold 8", "Dyson V15 Detect", "Roborock S8", "Anker Soundcore Liberty 4 NC", "Nike Pegasus 41")
-> "single" tipinde DETAYLI JSON döndür!
-> Hangi marka, hangi tam model ve hangi kategoriyi değerlendirdiğini açıkça belirt!
-> Ürünün Türkiye fiyat aralığını (price_range_try), 4-5 öne çıkan teknik özelliğini (key_specs), kapsamlı 3-4 cümlelik kullanıcı & piyasa değerlendirmesini (verdict), 5 satırlık Pozitifler/Negatifler tablosunu, kimler almalı/uzak durmalı özetini ve **birebir aynı kategoriden** gerçek bir **Daha İyi Alternatif** (kendi price_range_try bilgisiyle!) döndür.

"single" JSON ŞEMASI:
{
  "type": "single",
  "evaluated_brand": "Marka Adı",
  "evaluated_model": "Tam Ürün Modeli",
  "product_category": "Ürün Kategorisi",
  "price_range_try": "Örn: 100.449 TL – 131.999 TL",
  "price_source_note": "${priceStatusLabel}",
  "title": "Tam Ürün Modeli — Detaylı Kullanıcı Yorumları & HEG Analizi",
  "heg_score": 8.8,
  "verdict_label": "KESİN ALINIR",
  "verdict": "Ürünün teknik gücü, gerçek kullanıcı deneyimi, kronik noktaları ve Türkiye fiyat/performans dengesini açıklayan 3-4 cümlelik kapsamlı, tarafsız HEG değerlendirmesi.",
  "key_specs": [
    {"label": "Özellik 1", "value": "Net değer"},
    {"label": "Özellik 2", "value": "Net değer"},
    {"label": "Özellik 3", "value": "Net değer"},
    {"label": "Özellik 4", "value": "Net değer"}
  ],
  "review_table": [
    {"topic": "Performans & Kalite", "positive": "Somut olumlu kullanıcı yorumu", "negative": "Somut olumsuz kullanıcı yorumu"},
    {"topic": "Fiyat & Değer", "positive": "Fiyatını hak eden güçlü yön", "negative": "Fiyat veya aksesuar eleştirisi"},
    {"topic": "Tasarım & Kullanım", "positive": "Günlük kullanımda övülen detay", "negative": "Ağırlık, ses veya konfor şikayeti"},
    {"topic": "Dayanıklılık & Pil", "positive": "Uzun ömür veya servis artısı", "negative": "Kronik sorun veya pil uyarısı"}
  ],
  "who_should_buy": "Bu ürünü kimlerin gönül rahatlığıyla alabileceği (1-2 cümle)",
  "who_should_skip": "Kimlerin bu üründen uzak durup alternatife bakması gerektiği (1-2 cümle)",
  "alternative": {
    "has_better": true,
    "brand": "Rakip Marka",
    "name": "Birebir Aynı Kategoriden Gerçek Rakip Marka ve Tam Model",
    "price_range_try": "Örn: 22.000 TL – 26.500 TL",
    "reason": "Bu alternatifin neden daha mantıklı olduğunun 1-2 cümlelik net özeti.",
    "price_advantage": "Fiyat açısından net avantajı",
    "feature_advantage": "Özellik açısından net üstünlüğü",
    "review_advantage": "Kullanıcı yorumları açısından net üstünlüğü"
  },
  "amazon_keyword": "Tam Ürün Modeli"
}

Not: verdict_label yalnızca şunlardan biri olsun: "KESİN ALINIR", "EN İYİ F/P", "ŞARTLI ALINIR", "ALINMAZ".`;
    }

    let parsedData = null;

    // 1. Primary Engine: NVIDIA Nemotron 3 Ultra (550B) with Lightning 30B automatic fallback
    if (env.NVIDIA_API_KEY) {
      const nvidiaModels = [
        env.NVIDIA_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b',
        'nvidia/nemotron-3.5-lightning-30b-a3b',
      ];

      for (const model of nvidiaModels) {
        if (parsedData) break;
        const isUltra = model.includes('ultra');
        try {
          const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(isUltra ? 55_000 : 25_000),
            body: JSON.stringify({
              model,
              temperature: 0.15,
              top_p: 0.9,
              max_tokens: 1850,
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
