// src/lib/local-catalog.ts
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
  hasDiscount: boolean,
  stock: number | null;
  hasVariants: boolean;
  variantCount: number;
  ratingValue: number | null;
  reviewCount: number | null;
};

export type CategoryPage = {
  maincategory: string | null;
  category: string | null;
  slug: string;
  meta: { title: string; description: string; image?: string } | any;
  description?: string | null;
  faqdesc?: string | null;
  faq?: Array<{ id: string | number; question: string; answer: string }>;
};

export type CategoryList = {
  categorySlug: string;
  items: ListItem[];
};

// a termék detail nálad sok mezőt tartalmaz → maradhat any,
// de a categorySlug legyen fix
export type ProductDetail = any & { categorySlug: string; slug: string };

const idxMod   = import.meta.glob("../data/index/products.index.json", { eager: true });
const catMods  = import.meta.glob("../data/categories/*.json", { eager: true });
const listMods = import.meta.glob("../data/category-products/*.list.json", { eager: true });
const prodMods = import.meta.glob("../data/products/*.json", { eager: true });

function pickDefault<T>(mod: any): T {
  return (mod?.default ?? mod) as T;
}

export function localGetGlobalIndex(): ListItem[] {
  const key = "../data/index/products.index.json";
  const mod = (idxMod as any)[key];
  return mod ? pickDefault<ListItem[]>(mod) : [];
}

export function localGetCategoryPage(categorySlug: string): CategoryPage | null {
  const key = `../data/categories/${categorySlug}.json`;
  const mod = (catMods as any)[key];
  return mod ? pickDefault<CategoryPage>(mod) : null;
}

export function localGetCategoryList(categorySlug: string): CategoryList | null {
  const key = `../data/category-products/${categorySlug}.list.json`;
  const mod = (listMods as any)[key];
  return mod ? pickDefault<CategoryList>(mod) : null;
}

export function localGetProductDetail(productSlug: string): ProductDetail | null {
  const key = `../data/products/${productSlug}.json`;
  const mod = (prodMods as any)[key];
  return mod ? pickDefault<ProductDetail>(mod) : null;
}

export function localGetAllCategorySlugs(): string[] {
  return Object.keys(catMods).map((p) => p.split("/").pop()!.replace(".json", ""));
}

export function localGetAllProductPaths(): { kategoria: string; slug: string }[] {
  // a route paramjaid: kategoria + slug
  return localGetGlobalIndex().map((x) => ({ kategoria: x.categorySlug, slug: x.slug }));
}