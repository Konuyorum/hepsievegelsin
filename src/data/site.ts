import type { VerdictKey, CatalogStatus } from '../lib/types';

export const SITE = {
  name: 'HEG — Hepsi Eve Gelsin',
  shortName: 'HEG',
  tagline: 'Gerçek İndirim · Tarafsız Analiz · Alınır mı?',
  description:
    'Türkiye’nin yapay zeka destekli tarafsız ürün derecelendirme, çoklu mağaza canlı fiyat karşılaştırma ve sahte indirim denetim platformu. Marka sponsorluğu yok, yalnızca gerçek veriler ve net kararlar.',
  url: 'https://www.hepsievegelsin.com',
  email: 'info@hepsievegelsin.com',
  altEmail: 'hepsievegelsin@gmail.com',
  amazonTag: 'hepsievegelsi-21',
  social: {
    youtubeHandle: '@hepsievegelsin',
    youtubeUrl: 'https://www.youtube.com/@hepsievegelsin',
    youtubeChannelId: 'UCEjrPWdPa9Fk1UIqQ7U9O0w',
    instagramHandle: '@hepsievegelsin',
    instagramUrl: 'https://www.instagram.com/hepsievegelsin',
  },
  lastUpdated: '26 Kasım 2026',
  lastUpdatedIso: '2026-11-26',
} as const;

export const VERDICT_META: Record<
  VerdictKey,
  {
    label: string;
    shortLabel: string;
    range: string;
    description: string;
    badgeClass: string;
    hex: string;
  }
> = {
  KESIN_ALINIR: {
    label: 'KESİN ALINIR',
    shortLabel: 'Kesin Alınır',
    range: '9.0 – 10.0',
    description: 'Son 6 ayın dip fiyat bandında, sınıfının teknik veya mantık lideri.',
    badgeClass: 'badge-deal',
    hex: '#E5B800',
  },
  FP_SAMPIYONU: {
    label: 'EN İYİ F/P',
    shortLabel: 'En İyi F/P',
    range: '8.0 – 8.9',
    description: 'Kusursuz olmasa da kendi fiyat segmentinde rakiplerine açık ara üstün.',
    badgeClass: 'badge-deal',
    hex: '#0251A0',
  },
  SARTLI_ALINIR: {
    label: 'ŞARTLI ALINIR',
    shortLabel: 'Şartlı Alınır',
    range: '6.5 – 7.9',
    description: 'Güçlü yönleri var ancak karar vermeden önce bilmeniz gereken 1–2 kritik eksi taşıyor.',
    badgeClass: 'badge-blue',
    hex: '#0251A0',
  },
  ALINMAZ: {
    label: 'ALINMAZ · UYARI',
    shortLabel: 'Alınmaz',
    range: '< 6.5',
    description: 'Şişirilmiş sahte indirim, kronik şikayet veya aynı bütçede çok daha iyi rakip mevcut.',
    badgeClass: 'badge-hot',
    hex: '#EF4444',
  },
};

export const CATALOG_STATUS_META: Record<
  CatalogStatus,
  { label: string; badgeClass: string }
> = {
  GERCEK_FIRSAT: {
    label: 'GERÇEK FIRSAT',
    badgeClass: 'badge-deal',
  },
  ONLINEDA_DAHA_UCUZ: {
    label: "ONLİNE'DA DAHA UCUZ",
    badgeClass: 'badge-blue',
  },
  ICERIK_UYARISI: {
    label: 'İÇERİK / FİYAT UYARISI',
    badgeClass: 'badge-hot',
  },
};

export function formatTRY(amount: number): string {
  return (
    new Intl.NumberFormat('tr-TR', {
      maximumFractionDigits: 0,
    }).format(amount) + ' ₺'
  );
}
