/**
 * Medusa → Astro adapter (SDK alapú, cache + fallback + teljes API)
 * Használja a @medusajs/js-sdk kliensét és a store endpointokat
 */

import productsLocal from "../data/products.json" with { type: "json" }
import productsSafe from "../data/products_safe.json" with { type: "json" }
import { sdk } from "../lib/medusa-client"
import type { HttpTypes } from "@medusajs/types"
import { USE_API } from "~/lib/useApiFlag.ts";

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
const fallbackProducts: Category[] =
  Array.isArray(productsLocal) && productsLocal.length > 0
    ? (productsLocal as Category[])
    : (productsSafe as Category[])

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
      return fallbackProducts;
    }

    // ✅ Csak az alap mezőket kérjük le
    const { collections } = await listCollections({
      fields: "id,handle,title,metadata",
    })

    if (!collections?.length) {
/*       console.warn("⚠️ Nincs collection → fallback JSON.") */
      return fallbackProducts
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
/* if (variants.length > 1){console.log(variants)}  */
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
    return fallbackProducts
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
    return fallbackProducts
  }
  if (cachedCategories && now - lastFetchTime < CACHE_TTL) return cachedCategories

  const cats = await fetchAllCategoriesWithProducts(true)
  cachedCategories = cats.length ? cats : fallbackProducts
  lastFetchTime = now
  return cachedCategories
}

/* -----------------------------------------------------
 *  Kiegészítő API-k
 * --------------------------------------------------- */

export async function fetchCategoriesOnly() {
  return await fetchAllCategoriesWithProducts(false)
}

export async function fetchCategoriesWithProducts() {
  return await fetchAllCategoriesWithProducts(true)
}

export async function fetchProductsByCategorySlug(slug: string) {
  const all = await getCachedCategoriesWithProducts()
  return all.find((c) => c.slug === slug)
}

export async function fetchCategoryMetaBySlug(slug: string) {
  const categories = await getCachedCategoriesWithProducts()
  const c = categories.find((cat) => cat.slug === slug)
  if (!c) return null
  return {
    maincategory: c.maincategory ?? "",
    category: c.category,
    slug: c.slug,
    meta: c.meta,
    description: c.description ?? "",
  }
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const categories = await getCachedCategoriesWithProducts()
  for (const cat of categories) {
    const product = cat.products?.find((p) => p.slug === slug)
    if (product) return product
  }
  return null
}

export async function fetchRelatedProducts(
  categorySlug: string,
  excludeSlug?: string
): Promise<Product[]> {
  const categories = await getCachedCategoriesWithProducts()
  const cat = categories.find((c) => c.slug === categorySlug)
  if (!cat) return []
  return (cat.products ?? []).filter((p) => p.slug !== excludeSlug).slice(0, 3)
}

export async function fetchDiscountedProducts(limit = 20): Promise<Product[]> {
  const categories = await getCachedCategoriesWithProducts()
  const allProducts = categories.flatMap((c) => c.products || [])
  const now = new Date()

  const discounted = allProducts.filter((p) => {
    const { discountPercent, discountValidUntil } = p
    if (!discountPercent || discountPercent <= 0 || !discountValidUntil) return false
    return new Date(discountValidUntil) >= now
  })

  return discounted.slice(0, limit)
}

/* -----------------------------------------------------
 *  Build-időben használható termékútvonalak lekérése
 *  → csak a Store API-t használja (biztonságos publikusan is)
 * --------------------------------------------------- */
export async function fetchProductPaths() {
  try {
    if (!USE_API) {
/*       console.info("🟡 USE_API=false → static product path generálás fallbackből."); */
      return fallbackProducts.flatMap((cat) =>
        (cat.products || []).map((p) => ({
          params: { kategoria: cat.slug, slug: p.slug },
        }))
      );
    }
    // Gyors cache – ha már le vannak töltve a kategóriák termékekkel
    const categories = await getCachedCategoriesWithProducts();

    // Ha cache/fallback JSON-ból jön
    if (!categories?.length) {
/*       console.warn("⚠️ Nincs kategória → fallback JSON-ból generálás."); */
      return (fallbackProducts as Category[]).flatMap((cat) =>
        (cat.products || []).map((p) => ({
          params: { kategoria: cat.slug, slug: p.slug },
        }))
      );
    }

    // Store API-s útvonalak generálása
    const paths = categories.flatMap((cat) =>
      (cat.products || []).map((p) => ({
        params: { kategoria: cat.slug, slug: p.slug },
      }))
    );

    return paths;
  } catch (e: any) {
    console.error("❌ fetchProductPaths hiba:", e?.message);
    // Fallback – biztonsági mentés a lokális JSON-ból
    return (productsLocal as Category[]).flatMap((cat) =>
      (cat.products || []).map((p) => ({
        params: { kategoria: cat.slug, slug: p.slug },
      }))
    );
  }
}

