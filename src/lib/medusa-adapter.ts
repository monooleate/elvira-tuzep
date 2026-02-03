/**
 * Medusa → Astro adapter (SDK alapú, cache + fallback + teljes API)
 * Használja a @medusajs/js-sdk kliensét és a store endpointokat
 */
import {
  localGetGlobalIndex,
  localGetCategoryPage,
  localGetCategoryList,
  localGetProductDetail,
  localGetAllCategorySlugs,
  localGetAllProductPaths,
} from "~/lib/local-catalog";

import { sdk } from "../lib/medusa-client"
import type { HttpTypes } from "@medusajs/types"
import { USE_API } from "~/lib/useApiFlag.ts";
console.error("MEDUSA-ADAPTER LOADED", { USE_API });

/* -----------------------------------------------------
 *  Típusdefiníciók
 * --------------------------------------------------- */
export type ProductSpecs = {
  length?: number
  width?: number
  height?: number
  weight?: number
  [key: string]: any
}

export type ProductImage = { src: string; alt: string }

export type Product = {
  name: string
  slug: string
  meta: { title: string; description: string; image?: string }
  aggregateRating?: { ratingValue?: number | null; reviewCount?: number | null }
  description?: string
  longDescription?: string
  longDescription2?: string
  longDescription3?: string
  material?: string
  audience?: string[]
  blogtags?: string[]
  image?: string | null
  images?: ProductImage[]
  sku?: string
  price?: number | null
  mprice?: number | null
  m2price?: number | null
  m3price?: number | null
  palprice?: number | null
  discountPrice?: number | null
  discountPercent?: number | null
  discountValidUntil?: string | null
  stock?: number | null
  specs?: ProductSpecs
  shippingDetails?: ProductSpecs
  category?: string
  categorySlug?: string
  variants?: any[] | null
}

export type Category = {
  maincategory: string
  category: string
  slug: string
  meta: { title: string; description: string; image?: string }
  description?: string
  faqdesc?: string
  faq?: Array<{ id: string; question: string; answer: string }>
  products?: Product[]
}

/* -----------------------------------------------------
 *  Fallback adatforrás
 * --------------------------------------------------- */

function buildLocalFallbackCategories(): Category[] {
  const slugs = localGetAllCategorySlugs();
  return slugs
    .map((s) => {
      const page = localGetCategoryPage(s);
      const list = localGetCategoryList(s);
      if (!page) return null;

      // ha nincs list file (ritka), akkor üres products
      return {
        ...page,
        products: (list?.items ?? []) as any,
      } as any;
    })
    .filter(Boolean) as any;
}


/* -----------------------------------------------------
 *  SDK alapú alapfüggvények
 * --------------------------------------------------- */

// ✅ Collection lista (mezők lekorlátozva)
export async function listCollections(
  queryParams: Record<string, string> = {}
): Promise<{ collections: HttpTypes.StoreCollection[]; count: number }> {
  if (!USE_API) {
/*     console.warn("🟡 listCollections kihagyva (USE_API=false)"); */
    return { collections: [], count: 0 };
  } 
  queryParams.limit = queryParams.limit || "100"
  queryParams.offset = queryParams.offset || "0"
  queryParams.fields = queryParams.fields || "id,handle,title,metadata"

  const { collections } = await sdk.client.fetch<{
    collections: HttpTypes.StoreCollection[]
  }>("/store/collections", {
    query: queryParams,
    cache: "force-cache",
  })

  return { collections, count: collections.length }
}

// ✅ Egy adott collection lekérése ID alapján
export async function retrieveCollection(
  id: string
): Promise<HttpTypes.StoreCollection> {
  const { collection } = await sdk.client.fetch<{ collection: HttpTypes.StoreCollection }>(
    `/store/collections/${id}`,
    { cache: "force-cache" }
  )
  return collection
}

// ✅ Termékek lekérése egy collection-höz
async function listProductsByCollectionId(collectionId: string, limit = 500) {
  try {
    const res = await sdk.client.fetch<{ products: HttpTypes.StoreProduct[] }>(
      `/store/products`,
      {
        query: {
          collection_id: collectionId,
          limit: String(limit),
          fields: "id,handle,title,metadata,description,*variants,variants.prices.*,*images",
        },
        cache: "force-cache",
      }
    )
/*     console.log(res.products) */
    return res.products ?? []
  } catch (e: any) {
    console.error(`⚠️ Hiba a terméklekérésnél (collection_id=${collectionId}):`, e?.message)
    return []
  }
}

/* -----------------------------------------------------
 *  Kategóriák + termékek (SDK verzió, fallback-kel)
 * --------------------------------------------------- */
export async function fetchAllCategoriesWithProducts(
  includeProducts = false
): Promise<Category[]> {
  try {
    // 🔹 Ha USE_API=false → azonnal fallback
    if (!USE_API) {
/*       console.info("🟡 USE_API=false → fallback JSON adat használatban."); */
      return buildLocalFallbackCategories();;
    }

    // ✅ Csak az alap mezőket kérjük le
    const { collections } = await listCollections({
      fields: "id,handle,title,metadata",
    })

    if (!collections?.length) {
/*       console.warn("⚠️ Nincs collection → fallback JSON.") */
      return buildLocalFallbackCategories();
    }

    const categories = await Promise.all(
      collections.map(async (c: any) => {
        let mappedProducts: Product[] = []

        if (includeProducts) {
          const products = await listProductsByCollectionId(c.id, 500)

          mappedProducts = products.map((p: any) => {
            const variants = Array.isArray(p.variants) ? p.variants : []
            const variant = variants[0]

            const imageUrls = Array.isArray(p.images)
              ? p.images.map((i: any) => i.url)
              : []
            const alts = Array.isArray(p.metadata?.image_alts)
              ? p.metadata.image_alts
              : []
            const images = imageUrls.map((src, i) => ({
              src,
              alt: alts[i] || "",
            }))

            const variantsObject =
              variants.length > 1
                ? variants.map((v: any) => ({
                    id: v.id,
                    title: v.title,
                    sku: v.sku,
                    variant_rank: v.variant_rank,
                    price: v.prices?.[0]?.amount ?? null,
                    stock: v.inventory_quantity ?? null,
                    metadata: v.metadata ?? {},
                    weight: v.weight ?? null,
                    length: v.length ?? null,
                    width: v.width ?? null,
                    height: v.height ?? null,
                  }))
                : null
/* if (variants.length > 1){console.log(variants[1].prices?.[0]?.amount ?? null,)}  */
            return {
              name: p.title,
              slug: p.handle,
              meta: {
                title: p.metadata?.seo_title || p.title,
                description: p.metadata?.seo_description || p.description || "",
                image: p.metadata?.seo_image || "",
              },
              aggregateRating: {
                ratingValue:
                  variant?.metadata?.aggregateRating?.ratingValue ?? p.metadata?.aggregateRating?.ratingValue ?? null,
                reviewCount:
                  variant?.metadata?.aggregateRating?.reviewCount ?? p.metadata?.aggregateRating?.reviewCount ?? null,
              },
              description: p.description,
              longDescription: p.metadata?.longDescription,
              longDescription2: p.metadata?.longDescription2,
              longDescription3: p.metadata?.longDescription3,
              material: p.metadata?.material || "",
              audience: p.metadata?.audience || [],
              blogtags: p.metadata?.blogtags || [],
              image: p.metadata?.image ?? null,
              images,
              sku: variant?.sku,
              price: variant?.prices?.[0]?.amount ?? null,
              mprice: variant?.metadata?.mprice ?? null,
              m2price: variant?.metadata?.m2price ?? null,
              m3price: variant?.metadata?.m3price ?? null,
              palprice: variant?.metadata?.palprice ?? null,
              discountPrice: variant?.metadata?.discountPrice ?? null,
              discountPercent: variant?.metadata?.discountPercent ?? null,
              discountValidUntil: variant?.metadata?.discountValidUntil ?? null,
              stock: variant?.metadata?.inventory ?? null,
              specs: p.metadata?.specs ?? {},
              shippingDetails: {
                weight: variant?.weight ?? null,
                length: variant?.length ?? null,
                width: variant?.width ?? null,
                height: variant?.height ?? null,
              },
              variants: variantsObject,
              category: c.handle,
              categorySlug: c.handle
            }
          })
        }
/*         console.log(mappedProducts) */
        return {
          maincategory: c.metadata?.maincategory ?? "",
          category: c.title,
          slug: c.handle,
          meta: {
            title: c.metadata?.seo_title || c.title,
            description: c.metadata?.seo_description || "",
            image: c.metadata?.seo_image || "",
          },
          description: c.metadata?.description || "",
          faq: c.metadata?.faq || [],
          faqdesc: c.metadata?.faqdesc || "",
          products: mappedProducts,
        }
      })
    )

    return categories
    
  } catch (err: any) {
    console.error("❌ Medusa SDK hiba:", err.message)
    return buildLocalFallbackCategories();
  }
}

/* -----------------------------------------------------
 *  Cache + Helper függvények
 * --------------------------------------------------- */
let cachedCategories: Category[] = []
let lastFetchTime = 0
const CACHE_TTL = 1000 * 60 * (Number(import.meta.env.CACHE_TTL_MINUTES) || 5)

export async function getCachedCategoriesWithProducts(): Promise<Category[]> {
  const now = Date.now()
   if (!USE_API) {
/*     console.info("🟡 USE_API=false → getCachedCategoriesWithProducts csak fallbacket ad vissza.") */
    return buildLocalFallbackCategories();
  }
  if (cachedCategories && now - lastFetchTime < CACHE_TTL) return cachedCategories

  const cats = await fetchAllCategoriesWithProducts(true)
  cachedCategories = cats.length ? cats : buildLocalFallbackCategories();
  lastFetchTime = now
  return cachedCategories
}

/* -----------------------------------------------------
 *  Kiegészítő API-k
 * --------------------------------------------------- */

export async function fetchCategoriesOnly(): Promise<Category[]> {
  if (!USE_API) {
    const slugs = localGetAllCategorySlugs();
    return slugs
      .map((s) => localGetCategoryPage(s))
      .filter(Boolean) as any;
  }
  return await fetchAllCategoriesWithProducts(false);
}

export async function fetchCategoriesWithProducts() {
  if (!USE_API) {
    const slugs = localGetAllCategorySlugs();
    return slugs
      .map((s) => {
        const page = localGetCategoryPage(s);
        const list = localGetCategoryList(s);
        if (!page || !list) return null;
        return { ...page, products: list.items as any };
      })
      .filter(Boolean) as any;
  }
  return await fetchAllCategoriesWithProducts(true);
}


export async function fetchProductsByCategorySlug(slug: string): Promise<Category | null> {
  if (!USE_API) {
    const page = localGetCategoryPage(slug);
    const list = localGetCategoryList(slug);
    if (!page || !list) return null;

    return {
      ...page,
      products: list.items as any, // list itemeket adunk, UI-hoz elég
    } as any;
  }

  const all = await getCachedCategoriesWithProducts();
  return all.find((c) => c.slug === slug) ?? null;
}



export async function fetchCategoryMetaBySlug(slug: string) {
  if (!USE_API) {
    const c = localGetCategoryPage(slug);
    if (!c) return null;
    return {
      maincategory: c.maincategory ?? "",
      category: c.category,
      slug: c.slug,
      meta: c.meta,
      description: c.description ?? "",
    };
  }

  const categories = await getCachedCategoriesWithProducts();
  const c = categories.find((cat) => cat.slug === slug);
  if (!c) return null;
  return {
    maincategory: c.maincategory ?? "",
    category: c.category,
    slug: c.slug,
    meta: c.meta,
    description: c.description ?? "",
  };
}


export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  if (!USE_API) {
    return (localGetProductDetail(slug) as any) ?? null;
  }

  // API ág maradhat (cache-ből keres)
  const categories = await getCachedCategoriesWithProducts();
  for (const cat of categories) {
    const product = cat.products?.find((p) => p.slug === slug);
    if (product) return product;
  }
  return null;
}

export async function fetchRelatedProducts(categorySlug: string, excludeSlug?: string) {
  if (!USE_API) {
    const list = localGetCategoryList(categorySlug);
    if (!list) return [];
    return list.items.filter((p) => p.slug !== excludeSlug).slice(0, 3) as any;
  }

  const categories = await getCachedCategoriesWithProducts();
  const cat = categories.find((c) => c.slug === categorySlug);
  if (!cat) return [];
  return (cat.products ?? []).filter((p) => p.slug !== excludeSlug).slice(0, 3);
}


// Cseréld le a medusa-adapter.ts-ben a fetchDiscountedProducts függvényt erre:
// Cseréld le a medusa-adapter.ts-ben a fetchDiscountedProducts függvényt:

export async function fetchDiscountedProductsAdapter(limit = 20) {
  if (!USE_API) {
    // Local mód: index.json-ból szűrés hasDiscount alapján
    const all = localGetGlobalIndex();
    
    // Egyszerű szűrés: hasDiscount === true
    const discounted = all.filter((p) => p.hasDiscount === true);
    console.log(discounted)
    return discounted.slice(0, limit);
  }

  // API mód: cache-ből, termék és variáns szintű akció ellenőrzés
  const now = new Date();
  const categories = await getCachedCategoriesWithProducts();
  const allProducts = categories.flatMap((c) => c.products || []);
  
  const discounted = allProducts.filter((p) => {
    // Termék szintű akció
    if (p.discountPercent && p.discountPercent > 0 && p.discountValidUntil) {
      if (new Date(p.discountValidUntil) >= now) {
        return true;
      }
    }
    
    // Variáns szintű akció
    if (Array.isArray(p.variants) && p.variants.length > 0) {
      return p.variants.some(v => 
        v.discountPercent && 
        v.discountPercent > 0 && 
        v.discountValidUntil &&
        new Date(v.discountValidUntil) >= now
      );
    }
    
    return false;
  });
  
  return discounted.slice(0, limit);
}
/* -----------------------------------------------------
 *  Build-időben használható termékútvonalak lekérése
 *  → csak a Store API-t használja (biztonságos publikusan is)
 * --------------------------------------------------- */
export async function fetchProductPaths() {
  if (!USE_API) {
    const paths = localGetAllProductPaths().map(({ kategoria, slug }) => ({
      params: { kategoria, slug },
    }));

    return paths;
  }

  // API-s logikád maradhat
  try {
    const categories = await getCachedCategoriesWithProducts();
    const paths = categories.flatMap((cat) =>
      (cat.products || []).map((p) => ({
        params: { kategoria: cat.slug, slug: p.slug },
      }))
    );
    return paths;
  } catch (e: any) {
    console.error("❌ fetchProductPaths hiba:", e?.message);
    return localGetAllProductPaths().map(({ kategoria, slug }) => ({
      params: { kategoria, slug },
    }));
  }
}

export async function fetchAllProductsIndex() {
  if (!USE_API) return localGetGlobalIndex();
  // API módban: cacheből flatmap (vagy Medusából külön endpoint)
  const cats = await getCachedCategoriesWithProducts();
  // itt map-old listItem shape-re, vagy egyszerűen add vissza a Product[]-ot ha a UI azt tudja
  return cats.flatMap((c) => c.products || []);
}

function normalizeDiscountedItem(p: any) {
  // Ha index rekord (local)
  if (p && typeof p === "object" && "priceFrom" in p && "categorySlug" in p) {
    return {
      slug: p.slug,
      categorySlug: p.categorySlug,
      name: p.name ?? "",
      image: p.image ?? null,
      price: p.priceFrom ?? null,
      discountPercent: p.discountPercent ?? null,
      discountValidUntil: p.discountValidUntil ?? null,
      hasVariants: p.hasVariants ?? false,
      priceTo: p.priceTo ?? null,
    };
  }

  // Ha full Product (API)
  return {
    slug: p.slug,
    categorySlug: p.categorySlug ?? p.category ?? null,
    name: p.name ?? "",
    image: p.meta?.image ?? p.image ?? (p.images?.[0]?.src ?? null),
    price: p.price ?? p.mprice ?? p.m2price ?? p.m3price ?? p.palprice ?? null,
    discountPercent: p.discountPercent ?? null,
    discountValidUntil: p.discountValidUntil ?? null,
    hasVariants: Array.isArray(p.variants) && p.variants.length > 0,
    priceTo: null,
  };
}




// Helyezd el a medusa-adapter.ts fájlba


/**
 * Variáns-szintű akció ellenőrzés
 */
function hasVariantDiscount(variants: any[], now: Date) {
  if (!Array.isArray(variants) || variants.length === 0) return false;
  
  return variants.some(v => {
    if (!v.discountPercent || v.discountPercent <= 0) return false;
    if (!v.discountValidUntil) return false;
    return new Date(v.discountValidUntil) >= now;
  });
}

/**
 * Termék-szintű akció ellenőrzés
 */
function hasProductDiscount(product: any, now: Date) {
  // Termék szintű akció
  if (product.discountPercent && product.discountPercent > 0 && product.discountValidUntil) {
    if (new Date(product.discountValidUntil) >= now) {
      return true;
    }
  }
  
  // Variáns szintű akció
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return hasVariantDiscount(product.variants, now);
  }
  
  return false;
}

/**
 * Normalizált termék adat akciós termékekhez
 */
function normalizeDiscountedProduct(p: any) {
  const isIndexRecord = p && typeof p === "object" && "priceFrom" in p;
  
  if (isIndexRecord) {
    // Index rekord (local vagy API lista)
    return {
      slug: p.slug,
      categorySlug: p.categorySlug,
      category: p.category ?? p.categorySlug,
      name: p.name ?? "",
      description: p.description ?? null,
      image: p.image ?? null,
      images: p.images ?? (p.image ? [{ src: p.image }] : []),
      
      // Árak
      price: p.priceFrom ?? p.price ?? null,
      priceFrom: p.priceFrom ?? null,
      priceTo: p.priceTo ?? null,
      
      // Akció adatok
      discountPercent: p.discountPercent ?? null,
      discountPrice: p.discountPrice ?? null,
      discountValidUntil: p.discountValidUntil ?? null,
      
      // Meta
      hasVariants: p.hasVariants ?? false,
      variants: p.variants ?? null,
      stock: p.stock ?? null,
      
      // SEO
      meta: p.meta ?? null,
      brandName: p.brandName ?? null
    };
  }

  // Full Product objektum (API vagy teljes adat)
  return {
    slug: p.slug,
    categorySlug: p.categorySlug ?? p.category ?? null,
    category: p.category ?? p.categorySlug ?? null,
    name: p.name ?? "",
    description: p.description ?? null,
    
    // Képek
    image: p.meta?.image ?? p.image ?? (p.images?.[0]?.src ?? null),
    images: p.images ?? (p.image ? [{ src: p.image }] : []),
    
    // Árak - ha van variants, onnan vesszük a legalacsonyabbat
    price: Array.isArray(p.variants) && p.variants.length > 0
      ? Math.min(...p.variants.map(v => v.price).filter(Boolean))
      : (p.price ?? p.mprice ?? p.m2price ?? p.m3price ?? p.palprice ?? null),
    
    priceFrom: Array.isArray(p.variants) && p.variants.length > 0
      ? Math.min(...p.variants.map(v => v.price).filter(Boolean))
      : (p.price ?? null),
    
    priceTo: Array.isArray(p.variants) && p.variants.length > 0
      ? Math.max(...p.variants.map(v => v.price).filter(Boolean))
      : null,
    
    // Akció adatok - termék szintű
    discountPercent: p.discountPercent ?? null,
    discountPrice: p.discountPrice ?? null,
    discountValidUntil: p.discountValidUntil ?? null,
    
    // Variánsok - TELJES adat
    hasVariants: Array.isArray(p.variants) && p.variants.length > 0,
    variants: Array.isArray(p.variants) && p.variants.length > 0
      ? p.variants.map(v => ({
          id: v.id,
          title: v.title ?? "Alap",
          sku: v.sku ?? null,
          price: v.price,
          stock: v.stock ?? null,
          discountPercent: v.discountPercent ?? null,
          discountPrice: v.discountPrice ?? null,
          discountValidUntil: v.discountValidUntil ?? null,
          variant_rank: v.variant_rank ?? 0,
          // További mezők ha kellenek
          mprice: v.mprice ?? null,
          m2price: v.m2price ?? null,
          m3price: v.m3price ?? null,
          palprice: v.palprice ?? null
        }))
      : null,
    
    stock: p.stock ?? null,
    
    // SEO
    meta: p.meta ?? null,
    brandName: p.brandName ?? null
  };
}

/**
 * Akciós termékek lekérése (termék VAGY variáns szinten)
 */
