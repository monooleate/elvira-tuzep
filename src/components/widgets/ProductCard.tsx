

import { useMemo } from "preact/hooks";
import { computeDiscountForCard, getDiscountBadge } from "~/lib/discounts";

type ImgItem = { src: string; alt?: string } | string;

type Variant = {
  id: string;
  title?: string;
  price: number;
  sku?: string;
  variant_rank?: number;
  stock?: number;
  mprice?: number;
  m2price?: number;
  m3price?: number;
  palprice?: number;
  discountPrice?: number;
  discountPercent?: number;
  discountValidUntil?: string;
};

type Product = {
  id?: string | number;
  sku?: string;
  name: string;
  slug: string;
  categorySlug?: string;
  description?: string;

  // képek
  images?: ImgItem[];
  image?: string | { src: string; alt?: string };

  variants?: Variant[];

  // régi / list item kompat
  price?: number;
  priceFrom?: number;
  priceTo?: number;

  mprice?: number;
  m2price?: number;
  m3price?: number;
  palprice?: number;

  discountPrice?: number;
  discountPercent?: number;
  discountValidUntil?: string;
  variantTitles?: string[];
  variantSkus?: string[];

  stock?: number;
  hasDiscount?: boolean;
  category?: string;
};

interface Props {
  product: Product;
  currentCategorySlug?: string;
}

function toBase(path: string) {
  return typeof path === "string" ? path.replace(/\.(jpe?g|png|webp|avif)$/i, "") : "";
}

function toCardSrc(src?: string) {
  if (!src) return "";

  // ha már -500.xxx
  if (/\-500\.(jpe?g|png|webp|avif)$/i.test(src)) return src;

  // ha van extension → tartsuk meg, csak -500-at tegyünk elé
  const m = src.match(/\.(jpe?g|png|webp|avif)$/i);
  if (m) {
    const ext = m[0].toLowerCase();
    return `${toBase(src)}-500${ext}`;
  }

  // ha nincs extension (pl. images[].src nálad ilyen) → legyen -500.avif
  return `${src}-500.avif`;
}

function isSingleVariantProduct(product: Product) {

  // LIST ITEM JSON
  if (Array.isArray(product.variantTitles)) {
    return product.variantTitles.length <= 1;
  }

  return true;
}


function pickPrimaryImage(p: Product): { src: string; alt: string } | null {
  if (Array.isArray(p?.images) && p.images.length >= 1) {
    const it = p.images[0];
    const rawSrc = typeof it === "string" ? it : it.src;
    const alt =
      typeof it === "string"
        ? p?.name ?? "Termékkép"
        : it.alt ?? p?.name ?? "Termékkép";
    const src = rawSrc ? toCardSrc(rawSrc) : "";
    return src ? { src, alt } : null;
  }
  // 2️⃣ ha nincs images → image mező
  if (p.image) {
    if (typeof p.image === "string") {
      return { src: p.image, alt: p.name ?? "Termékkép" };
    }
    if (typeof p.image === "object" && p.image.src) {
      return {
        src: p.image.src,
        alt: p.image.alt ?? p.name ?? "Termékkép",
      };
    }
  }

  return null;
}

function pickSecondaryImage(p: Product) {
  if (Array.isArray(p?.images) && p.images.length > 1) {
    const it = p.images[1]!;
    const raw = typeof it === "string" ? it : it?.src;
    const alt =
      typeof it === "string" ? p?.name ?? "Termékkép" : it?.alt ?? p?.name ?? "Termékkép";
    return raw ? { src: toCardSrc(raw), alt } : null;
  }
  return null;
}

function formatHU(n: number) {
  return n.toLocaleString("hu-HU");
}

function computeUnitDiscount(unitPrice: number | undefined | null, discountPercent: number | null) {
  if (typeof unitPrice !== "number" || unitPrice <= 0) return null;
  if (typeof discountPercent !== "number" || discountPercent <= 0) return null;
  return Math.round(unitPrice * (1 - discountPercent / 100));
}

export default function ProductCard({ product, currentCategorySlug }: Props) {
  const primary = pickPrimaryImage(product);
  const secondary = pickSecondaryImage(product);

  const badge = useMemo(() => getDiscountBadge(product), [product]);
  // ✅ árképzés (min/max + régi/új)
  const priceInfo = useMemo(() => {
    // 1) Variánsos termék
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      const variants = product.variants;

      const originals = variants.map((v) => (typeof v.price === "number" ? v.price : 0)).filter((n) => n > 0);
      const originalMin = originals.length ? Math.min(...originals) : 0;

      const computed = variants.map((v) => {
        const d = computeDiscountForCard(v as any);
        const final = d.hasDiscount && typeof d.discountPrice === "number" ? d.discountPrice : v.price;
        const pct = typeof d.discountPercent === "number" ? d.discountPercent : 0;
        return {
          original: v.price,
          final,
          hasDiscount: d.hasDiscount,
          pct,
          stock: v.stock,
        };
      });

      const finals = computed.map((x) => x.final).filter((n) => typeof n === "number" && n > 0) as number[];
      const minPrice = finals.length ? Math.min(...finals) : originalMin;
      const maxPrice = finals.length ? Math.max(...finals) : originalMin;

      const hasAnyDiscount = computed.some((x) => x.hasDiscount) || badge.hasDiscount === true;
      const maxDiscountPercent = computed.reduce((m, x) => Math.max(m, x.pct), 0);

      const hasAnyStock = computed.some((x) => typeof x.stock === "number" && x.stock > 0);

      // “firstVariant” extra unit árakhoz
      const firstVariant = variants[0];
      const firstDisc = computeDiscountForCard(firstVariant as any);
      
      return {
        hasPrice: true,
        isSingle: isSingleVariantProduct(product),
        minPrice,
        maxPrice,
        originalMinPrice: originalMin || minPrice || 0,
        hasAnyDiscount,
        maxDiscountPercent,
        hasAnyStock,
        firstVariant,
        firstDiscount: firstDisc,
      };
    }

    // 2) List item / régi struktúra
    const base =
      (typeof product.price === "number" && product.price > 0 ? product.price : null) ??
      (typeof (product as any).priceFrom === "number" && (product as any).priceFrom > 0 ? (product as any).priceFrom : null) ??
      0;

    const hasPrice = typeof base === "number" && base > 0;

    const disc = computeDiscountForCard({ ...product, price: base } as any);

    return {
      hasPrice,
      isSingle: isSingleVariantProduct(product),
      minPrice: disc.hasDiscount && typeof disc.discountPrice === "number" ? disc.discountPrice : base,
      maxPrice: disc.hasDiscount && typeof disc.discountPrice === "number" ? disc.discountPrice : base,
      originalMinPrice: base,
      hasAnyDiscount: disc.hasDiscount || badge.hasDiscount === true,
      maxDiscountPercent: typeof disc.discountPercent === "number" ? disc.discountPercent : 0,
      hasAnyStock: typeof product.stock === "number" && product.stock > 0,
      firstVariant: null as any,
      firstDiscount: disc,
    };
  }, [product, badge.hasDiscount]);

  const {
    hasPrice,
    isSingle,
    minPrice,
    maxPrice,
    originalMinPrice,
    hasAnyDiscount,
    maxDiscountPercent,
    hasAnyStock,
    firstVariant,
    firstDiscount,
  } = priceInfo;

  // ✅ extra egységárakhoz mindig legyen forrás
  const priceSource: any = firstVariant || product;

  // ✅ egységár % kedvezmény: badge-ből (ha van), különben firstDiscount-ből
  const pctForUnits = useMemo(() => {
    if (typeof badge.discountPercent === "number") return badge.discountPercent;
    if (typeof firstDiscount.discountPercent === "number") return firstDiscount.discountPercent;
    return null;
  }, [badge.discountPercent, firstDiscount.discountPercent]);

  const discountMPrice = computeUnitDiscount(priceSource.mprice, pctForUnits);
  const discountM2Price = computeUnitDiscount(priceSource.m2price, pctForUnits);
  const discountM3Price = computeUnitDiscount(priceSource.m3price, pctForUnits);
  const discountPalPrice = computeUnitDiscount(priceSource.palprice, pctForUnits);

  const category =
    currentCategorySlug || product.categorySlug || product.category || "egyeb";

  const href = `/termekek/${category}/${product.slug}`;

  const discountPercentView =
    typeof badge.discountPercent === "number"
      ? Number(badge.discountPercent.toFixed(1))
      : typeof maxDiscountPercent === "number" && maxDiscountPercent > 0
        ? Number(maxDiscountPercent.toFixed(1))
        : null;

  return (
    <a
      href={href}
      class="py-2 group relative block border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition bg-white dark:bg-gray-800 dark:border-gray-700"
      aria-label={product.name}
    >
      {hasAnyDiscount && (
        <div class="absolute top-2 left-2 bg-red-600 text-white text-sm font-bold px-2 py-1 rounded z-10 shadow">
          Akció
        </div>
      )}

      {hasAnyDiscount && typeof discountPercentView === "number" && discountPercentView > 0 && (
        <div class="absolute top-2 right-2 bg-red-600 text-white text-sm font-extrabold px-3 py-1 rounded z-10 shadow">
          -{discountPercentView}%
        </div>
      )}

      <div class="relative bg-white dark:bg-gray-900">
        <div class="relative overflow-hidden bg-white dark:bg-gray-900">
          <div class="w-full aspect-[4/3] relative">
            {primary && (
              <img
                src={primary.src}
                alt={primary.alt}
                class={`absolute inset-0 w-full h-full object-contain bg-white dark:bg-gray-900 transition-opacity duration-200 ${
                  secondary ? "group-hover:opacity-0" : ""
                }`}
                loading="lazy"
                decoding="async"
              />
            )}
            {secondary && (
              <img
                src={secondary.src}
                alt={secondary.alt}
                class="absolute inset-0 w-full h-full object-contain bg-white dark:bg-gray-900 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                loading="lazy"
                decoding="async"
                aria-hidden="true"
              />
            )}
          </div>
        </div>
      </div>

      <div class="p-4">
        <p class="text-lg font-semibold text-gray-900 dark:text-white">
          {product.name}
        </p>

        {product.description && (
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {product.description}
          </p>
        )}

        <div class="mt-2 space-y-1">
          {/* Darabár */}
          {hasPrice && (
            <>
              {isSingle ? (
                // ✅ Egy variáns / list item: marad a sima "/ db"
                hasAnyDiscount && firstDiscount.hasDiscount && firstDiscount.discountPrice !== null ? (
                  <>
                    <p class="text-sm text-gray-500 line-through">
                      {formatHU(originalMinPrice)} Ft / db
                    </p>
                    <p class="text-sm text-red-600 font-bold">
                      {formatHU(firstDiscount.discountPrice)} Ft / db
                    </p>
                  </>
                ) : (
                  <p class="text-sm font-medium text-gray-800 dark:text-gray-300">
                    {formatHU(originalMinPrice)} Ft / db
                  </p>
                )
              ) : (
                // ✅ Több variáns: MINDIG "/ db-tól" (akkor is, ha min==max)
                <>
        
                    <p class="text-sm text-gray-500 ">
                      {formatHU(originalMinPrice)} Ft / db-tól
                    </p>


                </>
              )}
            </>
          )}


          {/* m ár */}
          {typeof priceSource.mprice === "number" && priceSource.mprice > 0 && (
            discountMPrice !== null ? (
              <>
                <p class="text-sm text-gray-500 line-through">
                  {formatHU(priceSource.mprice)} Ft / m
                </p>
                <p class="text-sm text-red-600 font-bold">
                  {formatHU(discountMPrice)} Ft / m
                </p>
              </>
            ) : (
              <p class="text-sm font-medium text-gray-800 dark:text-gray-300">
                {formatHU(priceSource.mprice)} Ft / m
              </p>
            )
          )}

          {/* m² ár */}
          {typeof priceSource.m2price === "number" && priceSource.m2price > 0 && (
            discountM2Price !== null ? (
              <>
                <p class="text-sm text-gray-500 line-through">
                  {formatHU(priceSource.m2price)} Ft / m²
                </p>
                <p class="text-sm text-red-600 font-bold">
                  {formatHU(discountM2Price)} Ft / m²
                </p>
              </>
            ) : (
              <p class="text-sm font-medium text-gray-800 dark:text-gray-300">
                {formatHU(priceSource.m2price)} Ft / m²
              </p>
            )
          )}

          {/* m³ ár */}
          {typeof priceSource.m3price === "number" && priceSource.m3price > 0 && (
            discountM3Price !== null ? (
              <>
                <p class="text-sm text-gray-500 line-through">
                  {formatHU(priceSource.m3price)} Ft / m³
                </p>
                <p class="text-sm text-red-600 font-bold">
                  {formatHU(discountM3Price)} Ft / m³
                </p>
              </>
            ) : (
              <p class="text-sm font-medium text-gray-800 dark:text-gray-300">
                {formatHU(priceSource.m3price)} Ft / m³
              </p>
            )
          )}

          {/* raklap ár */}
          {typeof priceSource.palprice === "number" && priceSource.palprice > 0 && (
            discountPalPrice !== null ? (
              <>
                <p class="text-sm text-gray-500 line-through">
                  {formatHU(priceSource.palprice)} Ft / raklap
                </p>
                <p class="text-sm text-red-600 font-bold">
                  {formatHU(discountPalPrice)} Ft / raklap
                </p>
              </>
            ) : (
              <p class="text-sm font-medium text-gray-800 dark:text-gray-300">
                {formatHU(priceSource.palprice)} Ft / raklap
              </p>
            )
          )}
        </div>

        <div class="mt-1">
          {hasAnyStock ? (
            <span class="text-green-600">Raktáron</span>
          ) : (
            <span class="text-orange-500">Rendelhető (2-3 munkanap)</span>
          )}
        </div>
      </div>
    </a>
  );
}
