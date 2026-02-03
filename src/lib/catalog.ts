// src/lib/catalog.ts
export type CategoryPage = {
  maincategory: string | null;
  category: string | null;
  slug: string;
  meta: any;
  description: string | null;
  faq: any[];
  faqdesc: string | null;
};

export type ListItem = {
  slug: string;
  categorySlug: string;
  name: string | null;
  image: string | null;
  sku: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  discountPercent: number | null;
  discountValidUntil: string | null;
  inStock: boolean;
  hasVariants: boolean;
  variantCount: number;
  ratingValue: number | null;
  reviewCount: number | null;
};

export type CategoryList = {
  categorySlug: string;
  items: ListItem[];
};

export type ProductDetail = any & { categorySlug: string };

const idxMod = import.meta.glob("../data/index/products.index.json", { eager: true });
const catMods = import.meta.glob("../data/categories/*.json", { eager: true });
const listMods = import.meta.glob("../data/category-products/*.list.json", { eager: true });
const prodMods = import.meta.glob("../data/products/*.json", { eager: true });

function pickDefault<T>(mod: any): T {
  return (mod?.default ?? mod) as T;
}

export function getGlobalIndex(): ListItem[] {
  const key = "../data/index/products.index.json";
  const mod = (idxMod as any)[key];
  return mod ? pickDefault<ListItem[]>(mod) : [];
}

export function getCategoryPage(categorySlug: string): CategoryPage | null {
  const key = `../data/categories/${categorySlug}.json`;
  const mod = (catMods as any)[key];
  return mod ? pickDefault<CategoryPage>(mod) : null;
}

export function getCategoryList(categorySlug: string): CategoryList | null {
  const key = `../data/category-products/${categorySlug}.list.json`;
  const mod = (listMods as any)[key];
  return mod ? pickDefault<CategoryList>(mod) : null;
}

export function getProductDetail(productSlug: string): ProductDetail | null {
  const key = `../data/products/${productSlug}.json`;
  const mod = (prodMods as any)[key];
  return mod ? pickDefault<ProductDetail>(mod) : null;
}

// getStaticPaths-hoz: minden kategória slug a fájlnevekből
export function getAllCategorySlugs(): string[] {
  return Object.keys(catMods).map((p) => p.split("/").pop()!.replace(".json", ""));
}

// getStaticPaths-hoz: minden termék {categorySlug, productSlug} a globális indexből
export function getAllProductPaths(): { categorySlug: string; productSlug: string }[] {
  return getGlobalIndex().map((x) => ({
    categorySlug: x.categorySlug,
    productSlug: x.slug,
  }));
}
