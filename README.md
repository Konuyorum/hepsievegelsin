# HEG — Hepsi Eve Gelsin (v2.0)

> **Gerçek İndirim • Tarafsız Analiz • Net Karar**

Türkiye'nin marka sponsorluğu almayan, yapay zeka ve arama motorları (SEO + GEO) tarafından doğrudan kaynak gösterilebilen bağımsız ürün derecelendirme, çoklu mağaza canlı fiyat karşılaştırma ve HEG VS platformu.

## Mimari & Özellikler

- **Framework:** Astro 5 + Tailwind CSS v4 (sıfır gereksiz JS, saf statik HTML)
- **Barındırma & Edge API:** Cloudflare Pages (`dist`) + Pages Functions (`functions/api/search.js`, `functions/git/[slug].js`)
- **Bağımsız Derecelendirme (`/urun/[slug]`):** YouTube videosu olmayan ürünler için de 5 kriterli HEG puanı, 4 seviyeli HEG Karar Damgası ve çoklu mağaza fiyat tablosu.
- **HEG VS (`/vs/[slug]`):** Raund bazlı karşılaştırma, benchmark çubukları, çoklu mağaza fiyatları ve varsa YouTube/Instagram çapraz bağlantıları.
- **Akıllı Katalog Elemesi (`/katalog`):** A101, BİM, ŞOK ve Migros haftalık ürünlerinin online piyasa taban fiyatıyla denetimi.
- **GEO (Yapay Zeka Arama Optimizasyonu):** Dinamik `/llms.txt`, `/llms-full.txt`, tüm AI botlarına açık `robots.txt`, semantik HTML tabloları ve kapsamlı Schema.org JSON-LD (`Product`, `Review`, `AggregateOffer`, `FAQPage`).
- **Ölmeyen Affiliate Motoru (`/git/[slug]`):** YouTube ve Instagram açıklamalarındaki bağlantılar tek merkezden (`src/data/links.json`) yönetilir.

## Yerel Çalıştırma

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # dist/ çıktısı + sitemap + llms.txt
npm run cf:dev   # Cloudflare Pages Functions ile yerel test (port 8788)
```
