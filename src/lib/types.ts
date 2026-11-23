export type VerdictKey = 'KESIN_ALINIR' | 'FP_SAMPIYONU' | 'SARTLI_ALINIR' | 'ALINMAZ';

export interface StoreOffer {
  store: string;
  price: number;
  oldPrice?: number;
  seller?: string;
  inStock: boolean;
  isLowest?: boolean;
  isAffiliate: boolean;
  redirectSlug: string;
  note?: string;
}

export interface ScoreCriterion {
  label: string;
  score: number; // 0-10
  summary: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface SocialLinks {
  youtubeUrl?: string;
  youtubeId?: string;
  youtubeTitle?: string;
  shortsUrl?: string;
  instagramUrl?: string;
  chapters?: { time: string; label: string }[];
}

export interface ProductReview {
  slug: string;
  name: string;
  brand: string;
  subtitle: string;
  category: string;
  categorySlug: string;
  datePublished: string; // ISO YYYY-MM-DD
  dateModified: string;  // ISO YYYY-MM-DD
  displayDate: string;   // e.g. "23 Kasım 2026"
  image: string;
  gallery?: string[];
  hegScore: number; // 0-10
  verdict: VerdictKey;
  verdictHeadline: string;
  tldr: string; // Answer-first summary for AI & humans (40-60 words)
  isFakeDealAlert?: boolean;
  fakeDealReason?: string;
  hasAffiliateLinks: boolean;
  featured?: boolean;
  listPrice: number;
  currentLowestPrice: number;
  netSavings: number;
  discountPercent: number;
  priceNote: string;
  reviewStats?: {
    source: string;
    count: number;
    rating: number;
    satisfactionPercent: number;
  };
  criteria: ScoreCriterion[];
  specs: { label: string; value: string }[];
  pros: string[];
  cons: string[];
  whoShouldBuy: string;
  whoShouldSkip: string;
  offers: StoreOffer[];
  social?: SocialLinks;
  faqs: FAQItem[];
}

export interface ComparisonRound {
  number: number;
  title: string;
  productAValue: string;
  productBValue: string;
  winner: 'A' | 'B' | 'TIE';
  winnerLabel: string;
  summary: string;
}

export interface BenchmarkBar {
  metric: string;
  subtitle: string;
  productALabel: string;
  productAValue: number;
  productADisplay: string;
  productBLabel: string;
  productBValue: number;
  productBDisplay: string;
  unit?: string;
}

export interface ComparisonSide {
  name: string;
  shortName: string;
  brand: string;
  image: string;
  hegScore: number;
  verdict: VerdictKey;
  lowestPrice: number;
  officialPrice?: number;
  bestStore: string;
  productSlug?: string;
  whoShouldBuy: string;
  offers: StoreOffer[];
}

export interface ComparisonArticle {
  slug: string;
  title: string;
  hookBadge: string; // e.g. "129.550 TL FARK!"
  subtitle: string;
  category: string;
  datePublished: string;
  dateModified: string;
  displayDate: string;
  thumbnail: string;
  tldr: string;
  hasAffiliateLinks: boolean;
  featured?: boolean;
  scoreA: number;
  scoreB: number;
  winnerSide: 'A' | 'B' | 'TIE';
  winnerName: string;
  priceDiffText: string;
  productA: ComparisonSide;
  productB: ComparisonSide;
  rounds: ComparisonRound[];
  benchmarks: BenchmarkBar[];
  social?: SocialLinks;
  faqs: FAQItem[];
}

export type CatalogStatus = 'GERCEK_FIRSAT' | 'ONLINEDA_DAHA_UCUZ' | 'ICERIK_UYARISI';

export interface CatalogItem {
  id: string;
  market: 'A101' | 'BİM' | 'ŞOK' | 'Migros';
  validDates: string;
  name: string;
  category: string;
  marketPrice: number;
  onlinePrice: number;
  status: CatalogStatus;
  verdictNote: string;
  onlineStore?: string;
  redirectSlug?: string;
  isAffiliate?: boolean;
}

export interface CatalogWeek {
  slug: string;
  title: string;
  weekLabel: string;
  dateModified: string;
  displayDate: string;
  summary: string;
  social?: SocialLinks;
  items: CatalogItem[];
}
