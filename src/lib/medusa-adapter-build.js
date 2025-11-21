/**
 * Medusa → Astro adapter (cache + fallback + log)
 * Netlify SSR-re optimalizált verzió (JS-kompatibilis)
 */

import productsLocal from "../data/products.json" with { type: "json" }
import productsSafe from "../data/products_safe.json" with { type: "json" }
import "dotenv/config"

const TOKEN = process.env.SECRET_API
const base = process.env.PUBLIC_API_BASE

const fallbackProducts =
  Array.isArray(productsLocal) && productsLocal.length > 0
    ? productsLocal
    : productsSafe

/* -----------------------------------------------------
 * Helper: biztonságos fetch cache-eléssel
 * --------------------------------------------------- */
async function safeFetchJson(url, fallback = null) {
  /* Always build json fallback at runtime */
  if (false) {
    return fallback
  }
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + TOKEN,
        "Cache-Control": "s-maxage=300, stale-while-revalidate=86400",
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    return json
  } catch (err) {
    return fallback
  }
}

/* -----------------------------------------------------
 * 1️⃣ Kategóriák + termékek (teljes JSON)
 * --------------------------------------------------- */
export async function fetchAllCategoriesWithProducts(productUpload = false) {
  const url = `${base}/admin/collections?limit=100`
  const data = await safeFetchJson(url, { collections: [] })
  console.log(`✅ Szerver válasz: ${data}`)

  if (!data || !Array.isArray(data.collections) || data.collections.length === 0) {
    return productsLocal
  }

  const categories = await Promise.all(
    data.collections.map(async (c) => {
      let mappedProducts = []

      if (productUpload) {
        const productData = await safeFetchJson(
          `${base}/admin/products?collection_id=${c.id}&limit=500`,
          { products: [] }
        )
        const products = productData?.products ?? []

        mappedProducts = products.map((p) => {
          const variants = Array.isArray(p.variants) ? p.variants : []
          const variant = p.variants?.[0]
          const imageUrls = Array.isArray(p.images)
            ? p.images.map((img) => img.url)
            : []
          const imageAlts = Array.isArray(p.metadata?.image_alts)
            ? p.metadata.image_alts
            : []
          const images = imageUrls.map((src, i) => ({
            src,
            alt: imageAlts[i] || "",
          }))
          
          const variantsObject =
            variants.length > 1
              ? variants.map((v) => ({
                  id: v.id,
                  title: v.title,
                  variantType: v.metadata?.variantType || null,
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
                variant?.metadata?.aggregateRating?.ratingValue ?? p.metadata?.aggregateRating?.ratingValue ?? null,
              reviewCount:
                variant?.metadata?.aggregateRating?.reviewCount ?? p.metadata?.aggregateRating?.reviewCount ?? null,
            },
            description: p.description,
            image: p?.metadata?.image ?? null,
            images,
            longDescription: p.metadata?.longDescription,
            longDescription2: p.metadata?.longDescription2,
            longDescription3: p.metadata?.longDescription3,
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

  return categories
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
export async function fetchProductsByCategorySlug(slug) {
  let all = await fetchAllCategoriesWithProducts(true)
  if (!Array.isArray(all) || all.length === 0) {
    all = productsLocal
  }
  return all.find((c) => c.slug === slug)
}

export async function fetchProductPaths() {
  const collections = await safeFetchJson(`${base}/admin/collections?limit=100`, {
    collections: [],
  })
  const paths = []

  if (!collections.collections || collections.collections.length === 0) {
    return productsLocal.flatMap((c) =>
      (c.products || []).map((p) => ({
        params: { kategoria: c.slug, slug: p.slug },
      }))
    )
  }

  for (const c of collections.collections || []) {
    const productData = await safeFetchJson(
      `${base}/admin/products?collection_id=${c.id}&limit=500`,
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
export async function fetchProductBySlug(slug) {
  const data = await safeFetchJson(`${base}/admin/products?handle=${slug}`, {
    products: [],
  })
  const p = data.products?.[0]
  if (!p) {
    for (const cat of fallbackProducts) {
      const found = cat.products?.find((pr) => pr.slug === slug)
      if (found) return found
    }
    return null
  }

  const variant = p.variants?.[0] ?? {}
  const imageUrls = Array.isArray(p.images) ? p.images.map((img) => img.url) : []
  const imageAlts = Array.isArray(p.metadata?.image_alts)
    ? p.metadata.image_alts
    : []
  const images = imageUrls.map((src, i) => ({ src, alt: imageAlts[i] || "" }))

  return {
    name: p.title,
    slug: p.handle,
    meta: {
      title: p.metadata?.seo_title || p.title,
      description: p.metadata?.seo_description || p.description || "",
      image: p.metadata?.seo_image || "",
    },
    aggregateRating: {
      ratingValue: variant?.metadata?.aggregateRating?.ratingValue ?? null,
      reviewCount: variant?.metadata?.aggregateRating?.reviewCount ?? null,
    },
    description: p.description || "",
    image: p?.metadata?.image ?? null,
    images,
    longDescription: p.metadata?.longDescription || "",
    longDescription2: p.metadata?.longDescription2 || "",
    material: p.material || "",
    audience: p.metadata?.audience || [],
    blogtags: p.metadata?.blogtags || [],
    sku: variant?.sku || "",
    price: variant?.prices?.[0]?.amount ?? null,
    mprice: variant?.metadata?.mprice ?? null,
    m2price: variant?.metadata?.m2price ?? null,
    m3price: variant?.metadata?.m3price ?? null,
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
  }
}

/* -----------------------------------------------------
 * 3️⃣ Kapcsolódó termékek (azonos kategória)
 * --------------------------------------------------- */
export async function fetchRelatedProducts(categorySlug, excludeSlug) {
  const colResp = await safeFetchJson(
    `${base}/admin/collections?handle=${categorySlug}`,
    { collections: [] }
  )
  const category = colResp.collections?.[0]

  if (!category) {
    const localCat = fallbackProducts.find((c) => c.slug === categorySlug)
    if (!localCat) return []
    return (localCat.products ?? [])
      .filter((p) => p.slug !== excludeSlug)
      .slice(0, 3)
  }

  const data = await safeFetchJson(
    `${base}/admin/products?collection_id=${category.id}&limit=10`,
    { products: [] }
  )

  const products = data.products ?? []
  const filtered = excludeSlug
    ? products.filter((p) => p.handle !== excludeSlug)
    : products

  const mapped = filtered.map((p) => {
    const variant = p.variants?.[0]
    const imageUrls = Array.isArray(p.images)
      ? p.images.map((img) => img.url)
      : []
    const imageAlts = Array.isArray(p.metadata?.image_alts)
      ? p.metadata.image_alts
      : []
    const images = imageUrls.map((src, i) => ({ src, alt: imageAlts[i] || "" }))
    return {
      name: p.title,
      slug: p.handle,
      meta: {
        title: p.metadata?.seo_title || p.title,
        description: p.metadata?.seo_description || p.description || "",
        image: p.metadata?.seo_image || "",
      },
      aggregateRating: {
        ratingValue: variant?.metadata?.aggregateRating?.ratingValue ?? null,
        reviewCount: variant?.metadata?.aggregateRating?.reviewCount ?? null,
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
      discountValidUntil: variant?.metadata?.discountValidUntil ?? null,
      stock: variant?.metadata?.inventory ?? null,
      specs: p.metadata?.specs ?? {},
      shippingDetails: {
        weight: variant?.weight ?? null,
        length: variant?.length ?? null,
        width: variant?.width ?? null,
        height: variant?.height ?? null,
      },
    }
  })

  return mapped.slice(0, 3)
}

export async function fetchCategoryMetaBySlug(slug) {
  const data = await safeFetchJson(`${base}/admin/collections?handle=${slug}`, {
    collections: [],
  })
  const c = data.collections?.[0]
  if (!c) {
    const local = fallbackProducts.find((cat) => cat.slug === slug)
    if (!local) return null
    return {
      maincategory: local.maincategory ?? "",
      category: local.category,
      slug: local.slug,
      meta: local.meta,
      description: local.description ?? "",
    }
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
  }
}
