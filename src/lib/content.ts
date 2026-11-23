import type { ProductReview, ComparisonArticle, CatalogWeek } from './types';

const productModules = import.meta.glob<{ default: ProductReview }>('../content/products/*.json', {
  eager: true,
});

const comparisonModules = import.meta.glob<{ default: ComparisonArticle }>(
  '../content/comparisons/*.json',
  { eager: true }
);

const catalogModules = import.meta.glob<{ default: CatalogWeek }>('../content/catalogs/*.json', {
  eager: true,
});

export function getAllProducts(): ProductReview[] {
  return Object.values(productModules)
    .map((m) => m.default)
    .sort((a, b) => b.dateModified.localeCompare(a.dateModified) || b.hegScore - a.hegScore);
}

export function getProductBySlug(slug: string): ProductReview | undefined {
  return getAllProducts().find((p) => p.slug === slug);
}

export function getAllComparisons(): ComparisonArticle[] {
  return Object.values(comparisonModules)
    .map((m) => m.default)
    .sort((a, b) => b.dateModified.localeCompare(a.dateModified));
}

export function getComparisonBySlug(slug: string): ComparisonArticle | undefined {
  return getAllComparisons().find((c) => c.slug === slug);
}

export function getAllCatalogs(): CatalogWeek[] {
  return Object.values(catalogModules)
    .map((m) => m.default)
    .sort((a, b) => b.dateModified.localeCompare(a.dateModified));
}

export function getLatestCatalog(): CatalogWeek | undefined {
  return getAllCatalogs()[0];
}
