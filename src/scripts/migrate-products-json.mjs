// scripts/migrate-products-json.mjs
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

// INPUT
const INPUT_PATH = path.join(ROOT, "src", "data", "products.json");

// OUTPUT DIRS
const OUT_BASE = path.join(ROOT, "src", "data");
const OUT_CATEGORIES = path.join(OUT_BASE, "categories");
const OUT_CATEGORY_LISTS = path.join(OUT_BASE, "category-products");
const OUT_PRODUCTS = path.join(OUT_BASE, "products");
const OUT_INDEX = path.join(OUT_BASE, "index");

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function safeFilename(slug) {
  // filesystem-safe; keep Hungarian chars, but remove path separators & weird chars
  const s = String(slug ?? "")
    .trim()
    .replaceAll("/", "-")
    .replaceAll("\\", "-")
    .replace(/[^\p{L}\p{N}\-_.]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!s) throw new Error(`Invalid slug for filename: "${slug}"`);
  return s;
}

function toNumberOrNull(v) {
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function computePricingAndStock(product) {
  const variants = Array.isArray(product.variants) ? product.variants : null;

  if (variants && variants.length > 0) {
    const prices = variants
      .map((v) => toNumberOrNull(v?.price))
      .filter((n) => n !== null);

    const minPrice = prices.length ? Math.min(...prices) : null;
    const maxPrice = prices.length ? Math.max(...prices) : null;

    const priceFrom = minPrice ?? toNumberOrNull(product.price) ?? null;
    const priceTo = maxPrice && minPrice && maxPrice !== minPrice ? maxPrice : null;

    return {
      hasVariants: true,
      variantCount: variants.length,
      priceFrom,
      priceTo,
    };
  }

  const priceFrom = toNumberOrNull(product.price) ?? null;

  return {
    hasVariants: false,
    variantCount: 0,
    priceFrom,
    priceTo: null,
  };
}


function pickListImage(product) {
  if (isNonEmptyString(product?.meta?.image)) return product.meta.image;
  if (isNonEmptyString(product?.image)) return product.image;
  const first = product?.images?.[0]?.src;
  if (isNonEmptyString(first)) return first;
  return null;
}

function computeStock(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : null;

  // Variánsos termék: összeadjuk a metadata.inventory mezőket
  if (variants && variants.length > 0) {
    let sum = 0;
    for (const v of variants) {
      const inv = v?.metadata?.inventory;
      const n = typeof inv === "number" ? inv : Number(inv ?? 0);
      if (Number.isFinite(n) && n > 0) sum += n;
    }
    return sum; // 0 ha nincs semmi
  }

  // Nem variánsos: termék stock mező
  const stockNum =
    typeof product?.stock === "number" ? product.stock : Number(product?.stock ?? 0);
  return Number.isFinite(stockNum) && stockNum > 0 ? stockNum : 0;
}

function pickListImages(product) {
  const imgs = Array.isArray(product?.images) ? product.images : [];
  return imgs
    .filter((img) => img && typeof img.src === "string" && img.src.trim() !== "")
    .map((img) => ({ src: img.src, alt: typeof img.alt === "string" ? img.alt : "" }));
}


function ratingFields(product) {
  const rv = product?.aggregateRating?.ratingValue;
  const rc = product?.aggregateRating?.reviewCount;

  const ratingValue = toNumberOrNull(rv);
  const reviewCount = toNumberOrNull(rc);

  return {
    ratingValue: ratingValue ?? null,
    reviewCount: reviewCount ?? null,
  };
}

async function ensureDirs() {
  await fs.mkdir(OUT_CATEGORIES, { recursive: true });
  await fs.mkdir(OUT_CATEGORY_LISTS, { recursive: true });
  await fs.mkdir(OUT_PRODUCTS, { recursive: true });
  await fs.mkdir(OUT_INDEX, { recursive: true });
}

async function readInput() {
  const raw = await fs.readFile(INPUT_PATH, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error(
      `Expected products.json to be an array like [ {...}, {...} ], got: ${typeof data}`
    );
  }
  return data;
}

async function writeJson(filePath, obj) {
  const json = JSON.stringify(obj, null, 2) + "\n";
  await fs.writeFile(filePath, json, "utf8");
}

async function main() {
  await ensureDirs();

  const categoriesArr = await readInput();

  const globalIndex = [];
  const seenProductSlugs = new Map(); // slug -> categorySlug
  const seenCategorySlugs = new Set();

  for (const cat of categoriesArr) {
    const categorySlug = cat?.slug;
    if (!isNonEmptyString(categorySlug)) {
      console.warn("⚠️ Skipping category with missing slug:", cat?.category);
      continue;
    }

    const catSlugFile = safeFilename(categorySlug);

    if (seenCategorySlugs.has(categorySlug)) {
      console.warn(`⚠️ Duplicate category slug "${categorySlug}" - last one wins.`);
    }
    seenCategorySlugs.add(categorySlug);

    // A) category page data
    const categoryPage = {
      maincategory: cat.maincategory ?? null,
      category: cat.category ?? null,
      slug: categorySlug,
      meta: cat.meta ?? null,
      description: cat.description ?? null,
      faq: Array.isArray(cat.faq) ? cat.faq : [],
      faqdesc: cat.faqdesc ?? null,
    };

    await writeJson(
      path.join(OUT_CATEGORIES, `${catSlugFile}.json`),
      categoryPage
    );

    // B) category list items from products[]
    const products = Array.isArray(cat.products) ? cat.products : [];
    const items = [];

    for (const p of products) {
      const productSlug = p?.slug;
      if (!isNonEmptyString(productSlug)) {
        console.warn(`⚠️ Skipping product with missing slug in category "${categorySlug}"`);
        continue;
      }

      // Detect duplicates across categories
      if (seenProductSlugs.has(productSlug)) {
        const prevCat = seenProductSlugs.get(productSlug);
        console.warn(
          `⚠️ Duplicate product slug "${productSlug}" in categories "${prevCat}" and "${categorySlug}". Keeping latest.`
        );
      }
      seenProductSlugs.set(productSlug, categorySlug);

      const pricing = computePricingAndStock(p);
      const { ratingValue, reviewCount } = ratingFields(p);
      const stock = computeStock(p);
      const images = pickListImages(p);
      const listItem = {
        slug: productSlug,
        categorySlug,
        name: p.name ?? null,
        image: pickListImage(p),
        images,
        sku: p.sku ?? null,
        priceFrom: pricing.priceFrom,
        priceTo: pricing.priceTo,
        discountPercent: p.discountPercent ?? null,
        discountValidUntil: p.discountValidUntil ?? null,
        stock,
        inStock: stock > 0,
        hasVariants: pricing.hasVariants,
        variantCount: pricing.variantCount,
        ratingValue,
        reviewCount,
      };

      items.push(listItem);
      globalIndex.push(listItem);

      // C) product detail file (full product, plus enforced categorySlug)
      const detail = {
        ...p,
        categorySlug,
      };

      // (opcionális) Ha nálad a termékben "category" mező slugként szerepel, azt meghagyjuk,
      // de a kanonikus mező a categorySlug.
      const prodFile = safeFilename(productSlug);
      await writeJson(path.join(OUT_PRODUCTS, `${prodFile}.json`), detail);
    }

    // stable ordering for list page
    items.sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "hu"));

    await writeJson(
      path.join(OUT_CATEGORY_LISTS, `${catSlugFile}.list.json`),
      {
        categorySlug,
        items,
      }
    );
  }

  // Global index sorting (optional): by name then category
  globalIndex.sort((a, b) => {
    const an = String(a.name ?? "");
    const bn = String(b.name ?? "");
    const ncmp = an.localeCompare(bn, "hu");
    if (ncmp !== 0) return ncmp;
    return String(a.categorySlug ?? "").localeCompare(String(b.categorySlug ?? ""), "hu");
  });

  await writeJson(path.join(OUT_INDEX, `products.index.json`), globalIndex);

  console.log("✅ Migration completed.");
  console.log(`- Categories: ${seenCategorySlugs.size}`);
  console.log(`- Products:   ${globalIndex.length}`);
  console.log("Output written to:");
  console.log(`  ${path.relative(ROOT, OUT_CATEGORIES)}/`);
  console.log(`  ${path.relative(ROOT, OUT_CATEGORY_LISTS)}/`);
  console.log(`  ${path.relative(ROOT, OUT_PRODUCTS)}/`);
  console.log(`  ${path.relative(ROOT, OUT_INDEX)}/products.index.json`);
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
