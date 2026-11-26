/**
 * HEG (Hepsi Eve Gelsin) v2 — Hardened AI Product & Category Analysis Edge Function
 * Route: POST /api/search
 * Primary AI Engine: NVIDIA Developer NIM API (Nemotron 3.5 Lightning + Bolt fallback)
 *
 * Modes:
 *  1. General Category / Ambiguous Term (e.g. "monitör", "ayakkabı", "Bosch 9"):
 *     -> Returns `type: "category_guided"` with interactive clarification questions/chips
 *        AND top 4 real brand+model recommendations (each with Pros, Cons, HEG Score & store links).
 *  2. Specific Brand + Model (e.g. "Dyson V15 Detect", "Roborock S8"):
 *     -> Returns `type: "single"` with explicit evaluated_brand, evaluated_model, product_category,
 *        4-row Pozitifler/Negatifler user-review table, and a same-category Better Alternative.
 *  3. VS Mode (two specific products):
 *     -> Returns `type: "comparison"` with criterion-by-criterion winner table.
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
          message: 'Lütfen yalnızca marka, ürün veya kategori adı girin (Örn: Dyson V15 Detect, monitör, ayakkabı).',
        }),
        { status: 400, headers }
      );
    }

    if (isQuestionOrInvalidProduct(query) || (isVS && isQuestionOrInvalidProduct(query2))) {
      return new Response(
        JSON.stringify({
          type: 'error',
          message:
            'AI Analiz alanına soru sorulamaz; yalnızca marka, ürün veya kategori adı girilebilir (Örn: Dyson V15 Detect, monitör, ayakkabı). Genel sorularınız için aşağıdaki Google Web Araştırması bölümünü kullanın.',
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
      'Kusursuz, doğal ve akıcı Türkiye Türkçesi kullan; uydurma kelime veya bozuk çeviri asla kullanma. ' +
      'SADECE geçerli ham JSON döndür (markdown blokları veya ekstra açıklama yazma). ' +
      'ASLA isimsiz/genel bir ürün yorumu yapma: her zaman Türkiye\'de (Amazon TR, Hepsiburada, Trendyol) satılan gerçek, somut MARKA + TAM MODEL adı ver. ' +
      'Eğer girdi alışveriş/ürün/kategori dışı bir ifadeyse SADECE şu JSON\'u döndür: ' +
      '{"type":"error","message":"AI Analiz yalnızca marka, ürün veya kategori adı içindir. Genel sorular için Google Web Araştırması bölümünü kullanın."}';

    let userPrompt = '';
    if (isVS) {
      userPrompt = `Türkiye piyasası gözüyle "${query}" ile "${query2}" ürünlerini gerçek kullanıcı yorumları, özellikler ve fiyat/performans açısından tarafsız karşılaştır.

KONTROL:
Kıyaslanabilir iki spesifik ürün değilse SADECE şu JSON'u döndür:
{"type":"error","message":"Karşılaştırma için benzer iki spesifik marka ve model girin (Örn: Roborock S8 vs Dreame L10s Ultra)."}

Kıyaslanabilirse SADECE şu JSON'u döndür:
{
  "type": "comparison",
  "p1_name": "Tam Marka ve Model 1",
  "p2_name": "Tam Marka ve Model 2",
  "summary": "İki ürün arasındaki kritik farkı ve hangisinin kime göre olduğunu anlatan 2-3 cümlelik tarafsız HEG kararı.",
  "table": [
    {"feature": "Kriter Adı", "val1": "Ürün 1 Değeri", "val2": "Ürün 2 Değeri", "winner": 1}
  ]
}`;
    } else {
      const filterClause =
        filters.length > 0
          ? `\nKULLANICININ SEÇTİĞİ FİLTRELER: ${filters.join(', ')} — Önerdiğin 4 gerçek marka/model KESİNLİKLE bu kriterlere birebir uysun!`
          : '';

      userPrompt = `Kullanıcı Girdisi: "${query}"${filterClause}

AKILLI YOL AYRIMI (ÇOK KRİTİK — MUTLAKA UY):

DURUM 1 — GENEL KATEGORİ veya BELİRSİZ/EKSİK MARKA-SERİ İSE:
(Örn: "monitör", "ayakkabı", "kulaklık", "telefon", "laptop", "airfryer", "robot süpürge", "kahve makinesi", "Adidas", "Bosch 9", "Samsung" gibi tek bir kesin tam modele işaret etmeyen her sorgu — veya filtre seçilmiş kategori sorgusu)
-> KESİNLİKLE "category_guided" tipinde JSON döndür!
-> ASLA "monitörler genel olarak iyidir" gibi isimsiz analiz yapma!
-> Hem kullanıcıya seçimini daraltması için 2-3 kısa netleştirme sorusu (tıklanabilir seçeneklerle; ör. Monitör için: "Kullanım Amacı", "Ekran Boyutu", "Bütçe"; Ayakkabı için: "Ayakkabı Türü", "Kullanım Amacı", "Öncelik"; Bosch 9 için: "Hangi Bosch 9 Ürünü?" -> "Unlimited 9 Dikey Süpürge", "Serie 8/9 Çamaşır Makinesi", "Serie 8/9 Bulaşık Makinesi") oluştur,
-> HEM DE Türkiye'de en çok tercih edilen, en iyi **4 adet GERÇEK MARKA + TAM MODEL** (ör. "LG UltraGear 27GS75Q-B", "Adidas Ultraboost Light", "Nike Pegasus 41" vb.) listele; her birinin kendi HEG puanı, 2 somut pozitif kullanıcı yorumu ve 2 somut negatif kullanıcı yorumu olsun!

"category_guided" JSON ŞEMASI:
{
  "type": "category_guided",
  "category_title": "${query} — En İyi 4 Gerçek Model & Seçim Rehberi",
  "intro": "Seçiminizi netleştirmek için aşağıdan kullanım amacınızı seçebilir veya Türkiye'de kullanıcı yorumları en güçlü 4 modeli hemen inceleyebilirsiniz.",
  "applied_filters": ${JSON.stringify(filters)},
  "clarify_questions": [
    {
      "question": "Kullanım amacınız nedir?",
      "options": ["Seçenek 1", "Seçenek 2", "Seçenek 3", "Seçenek 4"]
    },
    {
      "question": "Boyut / Tür tercihiniz?",
      "options": ["Seçenek A", "Seçenek B", "Seçenek C"]
    }
  ],
  "items": [
    {
      "brand": "Gerçek Marka (Örn: LG)",
      "model": "Tam Model Adı (Örn: LG UltraGear 27GS75Q-B 27 inç 180Hz IPS)",
      "tag": "En İyi F/P",
      "heg_score": 8.9,
      "summary": "Neden bu listede olduğunu anlatan 1 net cümle",
      "positives": ["Somut olumlu kullanıcı yorumu 1", "Somut olumlu kullanıcı yorumu 2"],
      "negatives": ["Somut olumsuz kullanıcı yorumu / şikayet 1", "Somut olumsuz kullanıcı yorumu 2"],
      "search_keyword": "LG UltraGear 27GS75Q-B"
    }
  ]
}

DURUM 2 — KESİN, TEK BİR SPESİFİK MARKA + TAM MODEL İSE:
(Örn: "Dyson V15 Detect", "Roborock S8", "Samsung Galaxy Z Fold 8", "Anker Soundcore Liberty 4 NC", "Philips HD9270 Airfryer", "Nike Pegasus 41")
-> "single" tipinde JSON döndür!
-> Hangi marka, hangi tam model ve hangi kategoriyi değerlendirdiğini açıkça belirt!
-> Daha iyi alternatif (alternative) KESİNLİKLE **birebir aynı kategoriden** gerçek bir rakip marka + tam model olsun (ör. dikey süpürgeye robot süpürge önerme, yine dikey süpürge öner!).

"single" JSON ŞEMASI:
{
  "type": "single",
  "evaluated_brand": "Marka Adı (Örn: Dyson)",
  "evaluated_model": "Tam Ürün Modeli (Örn: Dyson V15 Detect Absolute)",
  "product_category": "Ürün Kategorisi (Örn: Şarjlı Dikey Süpürge)",
  "title": "Dyson V15 Detect Absolute — Kullanıcı Yorumları & HEG Analizi",
  "heg_score": 8.2,
  "verdict_label": "ŞARTLI ALINIR",
  "verdict": "Bu tam modelin gerçek kullanıcı yorumları ve fiyat/performans dengesine dayanan 2-3 cümlelik tarafsız HEG özeti.",
  "review_table": [
    {
      "topic": "Performans & Kalite",
      "positive": "Kullanıcıların en çok övdüğü somut olumlu deneyim",
      "negative": "Kullanıcıların en sık şikayet ettiği somut olumsuz nokta"
    },
    {
      "topic": "Fiyat & Değer Dengesi",
      "positive": "Fiyatını hak eden güçlü yönü",
      "negative": "Fiyat veya aksesuar açısından eleştirilen yönü"
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
    "brand": "Rakip Marka",
    "name": "Aynı Kategoriden Gerçek Rakip Marka ve Tam Model",
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
            signal: AbortSignal.timeout(22_000),
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
            max_tokens: 1850,
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
