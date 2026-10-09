/**
 * Hepsi Eve Gelsin - AI Shopping Assistant Worker
 * Powered by Anthropic Claude 3.5 Haiku & Cloudflare Pages Edge Runtime
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);

    if (url.pathname === "/api/search" && request.method === "POST") {
      try {
        const body = await request.json();
        const query = (body.query || "").trim();
        const query2 = (body.query2 || "").trim();
        const isVS = Boolean(body.isVS);

        if (!query) {
          return new Response(JSON.stringify({ type: "error", message: "Lütfen bir ürün veya kategori adı girin." }), {
            status: 400,
            headers: corsHeaders
          });
        }

        let prompt = "";
        
        if (isVS) {
          prompt = `Sen kıdemli bir e-ticaret ve ürün inceleme uzmanısın. "${query}" ile "${query2}" ürünlerini karşılaştır.
          
KONTROL (ÇOK ÖNEMLİ):
Eğer kullanıcının girdiği ürünlerden biri genel bir kategori (Örn: "Telefon", "Kazak"), diğeri ise spesifik bir ürünse (Örn: "iPhone 15"), ya da tamamen alakasız iki ürünse bunları kıyaslama!
Böyle bir durumda SADECE şu JSON'u döndür:
{ "type": "error", "message": "Elma ile armudu kıyaslayamayız :) Lütfen karşılaştırmak için benzer iki spesifik model girin (Örn: iPhone 15 vs Galaxy S24)." }

EĞER İKİSİ DE BENZER VE KIYASLANABİLİR ÜRÜNSE (Örn: İki farklı telefon, iki farklı kulaklık):
{
  "type": "comparison",
  "p1_name": "${query}",
  "p2_name": "${query2}",
  "summary": "İki ürün arasındaki farkı anlatan 2 cümlelik net uzman kararı.",
  "table": [
    {"feature": "Kriter Adı", "val1": "Ürün 1 Değeri", "val2": "Ürün 2 Değeri", "winner": 1}
  ]
}`;
        } else {
          prompt = `Sen 'Hepsi Eve Gelsin' platformunun zeki alışveriş asistanısın. Sorgu: "${query}"
          
TÜRKİYE VE E-TİCARET ŞARTI (KRİTİK):
Önereceğin tüm markalar, modeller ve ürünler KESİNLİKLE Türkiye'de (Amazon TR, Trendyol, Hepsiburada vb.) aktif olarak satılan, bilindik ve popüler markalar olmak ZORUNDADIR. Türkiye'de bulunmayan niş veya yabancı markaları ASLA önerme.

AKILLI YOL AYRIMI:
1. EĞER sorgu GENEL BİR KATEGORİ ise ("Kazak", "Robot Süpürge", "Kablosuz Kulaklık" vb.):
   Sadece "list" tipinde JSON döndür. (En iyi 4 ürünü tavsiye et).
2. EĞER sorgu SPESİFİK BİR ÜRÜN ise ("iPhone 15", "Sony WH-1000XM5", "Philips Airfryer" vb.):
   Sadece "single" tipinde JSON döndür. (Detaylı inceleme yap).
   
KATEGORİ İKONLARI (Single tipinde 'icon' alanı için FontAwesome sınıfı seç):
- Teknoloji: "fas fa-microchip", Giyim/Moda: "fas fa-tshirt", Ev/Yaşam: "fas fa-couch", Kozmetik: "fas fa-magic", Genel: "fas fa-star"

A) LİSTE TİPİ JSON FORMATI:
{
  "type": "list", 
  "title": "${query} İçin En İyi Tavsiyeler",
  "items": [ 
    { "name": "Marka ve Tam Model", "desc": "1 cümlelik net tavsiye nedeni", "tag": "Fiyat/Performans vb." } 
  ]
}

B) SINGLE (TEK ÜRÜN) TİPİ JSON FORMATI:
{
  "type": "single", 
  "title": "${query} İncelemesi", 
  "icon": "fas fa-microchip", 
  "verdict": "Ürün hakkında 2 paragraf uzman yorumu.",
  "pros": "<ul><li>Artı özellik 1</li><li>Artı özellik 2</li></ul>", 
  "cons": "<ul><li>Eksi özellik 1</li></ul>",
  "amazon_keyword": "${query}"
}`;
        }

        let parsedData = null;

        // 1. Anthropic Claude API (Birincil AI Motoru - Claude 3.5 Haiku)
        const anthropicApiKey = env.ANTHROPIC_API_KEY;
        if (anthropicApiKey) {
          try {
            const claudeModel = env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022";
            const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": anthropicApiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
              },
              body: JSON.stringify({
                model: claudeModel,
                max_tokens: 1024,
                system: "You are the smart e-commerce shopping intelligence assistant for Hepsi Eve Gelsin. You MUST respond ONLY with valid raw JSON. Never output markdown fences (```json or ```), explanations, or greetings. Output raw JSON object only.",
                messages: [{ role: "user", content: prompt }]
              })
            });

            if (claudeRes.ok) {
              const claudeData = await claudeRes.json();
              const rawText = claudeData.content?.[0]?.text || "";
              const cleanText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
              const jsonMatch = cleanText.match(/(\{|\[)[\s\S]*(\}|\])/);
              if (jsonMatch) {
                parsedData = JSON.parse(jsonMatch[0]);
              }
            } else {
              console.error("Claude API non-OK status:", claudeRes.status, await claudeRes.text());
            }
          } catch (err) {
            console.error("Claude API invocation error:", err);
          }
        }

        // 2. Fallback: Google Gemini API (Yedek AI Sağlayıcısı)
        if (!parsedData) {
          const geminiApiKey = env.GEMINI_API_KEY;
          if (geminiApiKey) {
            const modelName = env.GEMINI_MODEL || "gemini-2.5-flash-lite";
            const safetySettings = [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ];

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                contents: [{ parts: [{ text: prompt }] }], 
                safetySettings,
                generationConfig: { response_mime_type: "application/json" }
              })
            });

            const data = await response.json();
            if (!data.error) {
              const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
              const cleanText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
              const jsonMatch = cleanText.match(/(\{|\[)[\s\S]*(\}|\])/);
              if (jsonMatch) {
                parsedData = JSON.parse(jsonMatch[0]);
              }
            }
          }
        }

        if (!parsedData) {
          throw new Error("AI provider response could not be parsed or no active API key.");
        }

        return new Response(JSON.stringify(parsedData), { headers: corsHeaders });

      } catch (e) {
        console.error("Search API Error:", e);
        return new Response(
          JSON.stringify({ type: "error", message: "Şu an yüksek yoğunluk var. Lütfen birkaç saniye sonra tekrar deneyin." }), 
          { status: 200, headers: corsHeaders }
        );
      }
    }
    
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not Found", { status: 404 });
  }
};
