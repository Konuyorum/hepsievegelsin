import type { VerdictKey, CatalogStatus } from '../lib/types';

export const SITE = {
  name: 'HEG — Hepsi Eve Gelsin',
  shortName: 'HEG',
  tagline: 'GERÇEK İNDİRİM • TARAFSIZ ANALİZ • NET KARAR',
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
  lastUpdated: '23 Kasım 2026',
  lastUpdatedIso: '2026-11-23',
} as const;

export const VERDICT_META: Record<
  VerdictKey,
  {
    label: string;
    shortLabel: string;
    range: string;
    description: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    hex: string;
  }
> = {
  KESIN_ALINIR: {
    label: 'KESİN ALINIR',
    shortLabel: 'Kesin Alınır',
    range: '9.0 – 10.0',
    description: 'Son 6 ayın dip fiyat bandında, sınıfının teknik veya mantık lideri.',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/40',
    hex: '#10B981',
  },
  FP_SAMPIYONU: {
    label: 'F/P ŞAMPİYONU',
    shortLabel: 'F/P Şampiyonu',
    range: '8.0 – 8.9',
    description: 'Kusursuz olmasa da kendi fiyat segmentinde rakiplerine açık ara üstün.',
    bgClass: 'bg-[#03519F]/20',
    textClass: 'text-sky-300',
    borderClass: 'border-sky-400/40',
    hex: '#03519F',
  },
  SARTLI_ALINIR: {
    label: 'ŞARTLI ALINIR',
    shortLabel: 'Şartlı Alınır',
    range: '6.5 – 7.9',
    description: 'Güçlü yönleri var ancak karar vermeden önce bilmeniz gereken 1–2 kritik eksi taşıyor.',
    bgClass: 'bg-[#FAD002]/15',
    textClass: 'text-[#FAD002]',
    borderClass: 'border-[#FAD002]/40',
    hex: '#FAD002',
  },
  ALINMAZ: {
    label: 'ALINMAZ / UYARI',
    shortLabel: 'Alınmaz',
    range: '< 6.5',
    description: 'Şişirilmiş sahte indirim, kronik şikayet veya aynı bütçede çok daha iyi rakip mevcut.',
    bgClass: 'bg-red-500/15',
    textClass: 'text-red-400',
    borderClass: 'border-red-500/45',
    hex: '#EF4444',
  },
};

export const CATALOG_STATUS_META: Record<
  CatalogStatus,
  { label: string; bgClass: string; textClass: string; borderClass: string }
> = {
  GERCEK_FIRSAT: {
    label: 'GERÇEK FIRSAT',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-500/30',
  },
  ONLINEDA_DAHA_UCUZ: {
    label: "ONLİNE'DA DAHA UCUZ",
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-800',
    borderClass: 'border-amber-500/35',
  },
  ICERIK_UYARISI: {
    label: 'İÇERİK / FİYAT UYARISI',
    bgClass: 'bg-red-500/15',
    textClass: 'text-red-700',
    borderClass: 'border-red-500/30',
  },
};

export function formatTRY(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 0,
  }).format(amount) + ' TL';
}
