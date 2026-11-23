/**
 * HEG (Hepsi Eve Gelsin) v2 — AI Shopping & Comparison Edge Function
 * Route: POST /api/search
 * Powered by Anthropic Claude 3.5 Haiku with Google Gemini Fallback
 */

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };

  try {
    const body = await request.json();
    const query = (body.query || '').trim();
    const query2 = (body.query2 || '').trim();
    const isVS = Boolean(body.isVS);

    if (!query) {
      return new Response(
        JSON.stringify({ type: 'error', message: 'Lütfen bir ürün veya kategori adı girin.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    let prompt = '';
    if (isVS) {
      prompt = `Sen HEG (Hepsi Eve Gelsin) platformunun tarafsız e-ticaret ve ürün kıyaslama uzmanısın. "${query}" ile "${query2}" ürünlerini Türkiye piyasası gözüyle objektif karşılaştır.

KONTROL:
Eğer ürünlerden biri genel bir kategori, diğeri spesifik bir ürünse veya kıyaslanamazsa SADECE şu JSON'u döndür:
{ "type": "error", "message": "Karşılaştırma için benzer iki spesifik model girin (Örn: Roborock S8 vs Dreame L10s Ultra)." }

Kıyaslanabilir iki ürünse SADECE şu JSON'u döndür:
{
  "type": "comparison",
  "p1_name": "${query}",
  "p2_name": "${query2}",
  "summary": "İki ürün arasındaki temel farkı, kimin hangisini alması gerektiğini söyleyen 2-3 cümlelik tarafsız HEG kararı.",
  "table": [
    {"feature": "Kriter Adı", "val1": "Ürün 1 Değeri", "val2": "Ürün 2 Değeri", "winner": 1}
  ]
}`;
    } else {
      prompt = `Sen 'Hepsi Eve Gelsin (HEG)' platformunun tarafsız, sponsorluksuz ürün analiz asistanısın. Sorgu: "${query}"

TÜRKİYE E-TİCARET KURALI:
Yalnızca Türkiye'de (Hepsiburada, Amazon TR, Trendyol vb.) aktif satılan gerçek marka ve modelleri değerlendir. Gerektiğinde eksileri açıkça söyle.

AKILLI YOL AYRIMI:
1. GENEL KATEGORİ ise ("Robot Süpürge", "Kablosuz Kulaklık", "Airfryer" vb.): "list" tipinde en mantıklı 4 ürünü öner.
2. SPESİFİK ÜRÜN ise ("Roborock S8", "Dyson V15", "iPhone 16 Pro" vb.): "single" tipinde tarafsız inceleme ve 10 üzerinden HEG puanı döndür.

A) LİSTE TİPİ JSON:
{
  "type": "list",
  "title": "${query} — HEG Tarafsız Önerileri",
  "items": [
    { "name": "Marka ve Tam Model", "desc": "1-2 cümlelik tarafsız neden ve dikkat edilecek detay", "tag": "F/P Şampiyonu / Kesin Alınır vb." }
  ]
}

B) TEK ÜRÜN TİPİ JSON:
{
  "type": "single",
  "title": "${query} — HEG Ön Analizi",
  "heg_score": 8.4,
  "verdict": "Ürün hakkında fiyat/performans, gerçek kullanıcı memnuniyeti ve kime uygun olduğu odaklı 2 paragraf tarafsız değerlendirme.",
  "pros": "<ul><li>Artı özellik 1</li><li>Artı özellik 2</li><li>Artı özellik 3</li></ul>",
  "cons": "<ul><li>Kritik eksi 1</li><li>Kritik eksi 2</li></ul>",
  "amazon_keyword": "${query}"
}`;
    }

    let parsedData = null;

    // 1. Primary: Anthropic Claude 3.5 Haiku
    if (env.ANTHROPIC_API_KEY) {
      try {
        const claudeModel = env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: claudeModel,
            max_tokens: 1200,
            system:
              'You are the unbiased Turkish e-commerce analyst for Hepsi Eve Gelsin (HEG). Respond ONLY with valid raw JSON. Never include markdown fences or commentary.',
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data.content?.[0]?.text || '';
          const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const match = clean.match(/(\{|\[)[\s\S]*(\}|\])/);
          if (match) parsedData = JSON.parse(match[0]);
        }
      } catch (err) {
        console.error('Claude error:', err);
      }
    }

    // 2. Fallback: Google Gemini
    if (!parsedData && env.GEMINI_API_KEY) {
      const modelName = env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: 'application/json' },
          }),
        }
      );
      const data = await res.json();
      if (!data.error) {
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const match = clean.match(/(\{|\[)[\s\S]*(\}|\])/);
        if (match) parsedData = JSON.parse(match[0]);
      }
    }

    if (!parsedData) {
      throw new Error('No AI provider returned a valid JSON payload.');
    }

    return new Response(JSON.stringify(parsedData), { headers: corsHeaders });
  } catch (e) {
    console.error('HEG /api/search error:', e);
    return new Response(
      JSON.stringify({
        type: 'error',
        message: 'Şu an yüksek yoğunluk var veya API anahtarı yapılandırılmamış. Lütfen birkaç saniye sonra tekrar deneyin.',
      }),
      { status: 200, headers: corsHeaders }
    );
  }
}
