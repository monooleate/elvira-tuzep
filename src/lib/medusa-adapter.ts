/**
 * Medusa → Astro adapter (cache + fallback + log)
 * Netlify SSR-re optimalizált verzió
 */

import productsLocal from "../data/products.json" with { type: "json" }
import productsSafe from "../data/products_safe.json" with { type: "json" }

export type ProductSpecs = {
  length?: number
  width?: number
  height?: number
  weight?: number
  [key: string]: any
}

export type ProductImage = {
  src: string
  alt: string
}

export type Product = {
  name: string
  slug: string
  meta: { title: string; description: string; image?: string }
  aggregateRating?: { ratingValue?: number | null; reviewCount?: number | null }
  description?: string
  longDescription?: string
  longDescription2?: string
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
  discountPrice?: number | null
  discountPercent?: number | null
  discountValidUntil?: string | null
  stock?: number | null
  specs?: ProductSpecs
  shippingDetails?: ProductSpecs
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

// 🧭 Környezeti változók (development vs production)
let TOKEN: string | undefined;
let BASE: string | undefined;
let USE_API: boolean;

if (process.env.NODE_ENV === "development") {
  // fejlesztés alatt az import.meta.env értékeit használjuk
  TOKEN = import.meta.env.SECRET_API;
  BASE = import.meta.env.PUBLIC_API_BASE || import.meta.env.PUBLIC_API_URL;
  USE_API = import.meta.env.PUBLIC_USE_API === "true";
  console.log("🧪 Fejlesztői környezet: import.meta.env értékek használatban.");
} else {
  // SSR / Netlify / production alatt a process.env értékeit
  TOKEN = process.env.SECRET_API;
  BASE = process.env.PUBLIC_API_BASE || process.env.PUBLIC_API_URL;
  USE_API = process.env.PUBLIC_USE_API === "true";
  console.log(`🚀 Production SSR: process.env értékek használatban. Token= ${TOKEN} Base= ${BASE} Use_API= ${USE_API}`);
}

// ENV validáció
if (!BASE) {
  console.warn("⚠️ Nincs beállítva PUBLIC_API_BASE vagy PUBLIC_API_URL")
}
if (!TOKEN) {
  console.warn("⚠️ Nincs beállítva SECRET_API token")
}

// Diagnosztikai log – csak fejlesztői módban
if (process.env.NODE_ENV !== "production") {
  console.log("🔍 SSR ENV:", {
    NODE_ENV: process.env.NODE_ENV,
    USE_API,
    BASE: BASE,
    TOKEN: TOKEN ? "[HIDDEN]" : "❌ missing",
  })
}

// 🪫 Fallback adatforrás
const fallbackProducts: Category[] = Array.isArray(productsLocal) && productsLocal.length > 0
  ? (productsLocal as Category[])
  : (productsSafe as Category[])

/* -----------------------------------------------------
 * Helper: biztonságos fetch cache-eléssel
 * --------------------------------------------------- */
async function safeFetchJson(url: string, fallback: any = null) {

  if (!USE_API) {
    console.warn(`ℹ️ USE_API=false → API lekérés kihagyva (${url})`);
    return fallback;
  }
  try {
    
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + TOKEN,
        "Cache-Control": "no-cache",
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    /* if (import.meta.env.DEV) console.log("✅ Fetched:", url) */
    console.warn(`ℹ️ USE_API=true → API lekérés sikeres (${url})`);
    return json
  } catch (err: any) {
    /* console.warn("⚠️ Medusa fetch failed:", url, err.message) */
    console.warn(`ℹ️ USE_API=error → API lekérés közben ERROR (${url})`);
    return fallback
  }
}

/* -----------------------------------------------------
 * 1️⃣ Kategóriák + termékek (teljes JSON)
 * --------------------------------------------------- */
export async function fetchAllCategoriesWithProducts(
  productUpload: boolean = false
): Promise<Category[]> {
  const url = `${BASE}/admin/collections?limit=100`

  const data = await safeFetchJson(url, { collections: [] })

  // ⚠️ ÚJ: ha nincs adat, vagy üres, vagy hibás a struktúra → fallback
  if (
    !data ||
    !Array.isArray(data.collections) ||
    data.collections.length === 0
  ) {
/*     console.warn("⚠️ Medusa API nem adott adatot, fallback productsLocal JSON-ra.") */
    return productsLocal
  }

  const categories: Category[] = await Promise.all(
    data.collections.map(async (c: any) => {
      // ha productUpload = false → nem töltünk terméket
      let mappedProducts: Product[] = []

      if (productUpload) {
        const productData = await safeFetchJson(
          `${BASE}/admin/products?collection_id=${c.id}&limit=500`,
          { products: [] }
        )

        const products = productData?.products ?? []

        mappedProducts = products.map((p: any) => {
          const variants = Array.isArray(p.variants) ? p.variants : []
          const variant = p.variants?.[0]


          // --- Képek és alt szövegek párosítása ---
          const imageUrls: string[] = Array.isArray(p.images)
            ? p.images.map((img: any) => img.url)
            : []

          const imageAlts: string[] = Array.isArray(p.metadata?.image_alts)
            ? p.metadata.image_alts
            : []

          const images = imageUrls.map((src, i) => ({
            src,
            alt: imageAlts[i] || "",
          }))

          // --- Ha több variáns van, hozzuk létre a variants objectet ---
          const variantsObject =
            variants.length > 1
              ? variants.map((v: any) => ({
                  id: v.id,
                  title: v.title,
                  type: v.metadata?.variantType || null,
                  sku: v.sku,
                  price: v.prices?.[0]?.amount ?? null,
                  stock: v.inventory_quantity ?? null,
                  metadata: v.metadata ?? {},
                  weight: v.weight ?? null,
                  length: v.length ?? null,
                  width: v.width ?? null,
                  height: v.height ?? null,
                }))
              : null

          return {
            name: p.title,
            slug: p.handle,
            meta: {
              title: p.metadata?.seo_title || p.title,
              description:
                p.metadata?.seo_description || p.description || "",
              image: p.metadata?.seo_image || "",
            },
            aggregateRating: {
              ratingValue:
                variant?.metadata?.aggregateRating?.ratingValue ?? null,
              reviewCount:
                variant?.metadata?.aggregateRating?.reviewCount ?? null,
            },
            description: p.description,
            image: p?.metadata?.image ?? null,
            images,
            longDescription: p.metadata?.longDescription,
            longDescription2: p.metadata?.longDescription2,
            material: p.material,
            audience: p.metadata?.audience || [],
            blogtags: p.metadata?.blogtags || [],
            sku: variant?.sku,
            price: variant?.prices?.[0]?.amount ?? null,
            mprice: variant?.metadata?.mprice ?? null,
            m2price: variant?.metadata?.m2price ?? null,
            m3price: variant?.metadata?.m3price ?? null,
            discountPrice: variant?.metadata?.discountPrice ?? null,
            discountPercent: variant?.metadata?.discountPercent ?? null,
            discountValidUntil:
              variant?.metadata?.discountValidUntil ?? null,
            stock: variant?.metadata?.inventory ?? null,
            specs: p.metadata?.specs ?? {},
            shippingDetails: {
              weight: variant?.weight ?? null,
              length: variant?.length ?? null,
              width: variant?.width ?? null,
              height: variant?.height ?? null,
            },
            variants: variantsObject,
            category: c.handle
          }
        })
      }
     
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

/*   console.log(
    `✅ ${categories.length} kategória betöltve ${productUpload} ${
      productUpload ? " termékekkel együtt " : ""
    }`
  ) */
  
  return categories
}

let cachedCategories: Category[] = []
let lastFetchTime = 0
const CACHE_TTL = 1000 * 60 * (Number(process.env.CACHE_TTL_MINUTES) || 5);

export async function getCachedCategoriesWithProducts(): Promise<Category[]> {
  const now = Date.now()
  if (cachedCategories && now - lastFetchTime < CACHE_TTL) return cachedCategories

  const cats = await fetchAllCategoriesWithProducts(true)
  cachedCategories = (cats && cats.length > 0) ? cats : fallbackProducts
  lastFetchTime = now
  return cachedCategories
}



// csak kategóriák
export async function fetchCategoriesOnly() {
  return await fetchAllCategoriesWithProducts(false)
}

// kategóriák + termékek
export async function fetchCategoriesWithProducts() {
  return await fetchAllCategoriesWithProducts(true)
}

// egy kategória termékei
export async function fetchProductsByCategorySlug(slug: string) {
  const all = await getCachedCategoriesWithProducts()
  return all.find(c => c.slug === slug)
}

export async function fetchProductPaths(): Promise<{ params: { kategoria: string; slug: string } }[]>  {
  const collections = await safeFetchJson(`${BASE}/admin/collections?limit=100`, { collections: [] })
  const paths: any[] = []

  if (!collections.collections || collections.collections.length === 0) {
/*     console.warn("⚠️ Nincs elérhető Medusa collection, fallback JSON-ból generáljuk a pathokat.") */
    return productsLocal.flatMap(c =>
      (c.products || []).map(p => ({
        params: { kategoria: c.slug, slug: p.slug }
      }))
    )
  }

  for (const c of collections.collections || []) {
    const productData = await safeFetchJson(
      `${BASE}/admin/products?collection_id=${c.id}&limit=500`,
      { products: [] }
    )
    const products = productData?.products ?? []
    for (const p of products) {
      paths.push({
        params: {
          kategoria: c.handle,
          slug: p.handle,
        },
      })
    }
  }
  return paths
}

/* -----------------------------------------------------
 * 2️⃣ Egy konkrét termék (slug alapján)
 * --------------------------------------------------- */
export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const categories = await getCachedCategoriesWithProducts()
  for (const cat of categories) {
    const product = cat.products?.find((p) => p.slug === slug)
    if (product) return product
  }
  return null
}

/* -----------------------------------------------------
 * 3️⃣ Kapcsolódó termékek (azonos kategória)
 * --------------------------------------------------- */
export async function fetchRelatedProducts(categorySlug: string, excludeSlug?: string): Promise<Product[]> {
  const categories = await getCachedCategoriesWithProducts()
  const cat = categories.find((c) => c.slug === categorySlug)
  if (!cat) return []
  return (cat.products ?? [])
    .filter((p) => p.slug !== excludeSlug)
    .slice(0, 3)
}

export async function fetchCategoryMetaBySlug(slug: string) {
  const categories = await getCachedCategoriesWithProducts()
  const c = categories.find(cat => cat.slug === slug)
  if (!c) return null
  return {
    maincategory: c.maincategory ?? "",
    category: c.category,
    slug: c.slug,
    meta: c.meta,
    description: c.description ?? "",
  }
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
