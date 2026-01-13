import { computeDiscountForCard, isDiscountActive, hasValidPercent } from '~/lib/discounts';

type ImgItem = { src: string; alt?: string } | string;

type Variant = {
  price?: number | null;
};

type Product = {
  id?: string | number;
  sku?: string;
  name: string;
  slug: string;
  categorySlug?: string;
  description?: string;
  images?: ImgItem[];
  image?: string | { src: string; alt?: string };
  variants?: Variant[] | null;

  price?: number;
  mprice?: number;
  m2price?: number;
  m3price?: number;
  palprice?: number;

  discountPrice?: number;
  discountPercent?: number;
  discountValidUntil?: string;

  stock?: number;
  category?: string;
};

function toBase(path: string) {
  return typeof path === 'string'
    ? path.replace(/\.(jpe?g|png|webp|avif)$/i, '')
    : '';
}
function toCardSrc(src?: string) {
  if (!src) return '';
  if (/\-\d+\.(jpe?g|png|webp|avif)$/i.test(src)) return src; // már fix méretes
  return `${toBase(src)}-500.jpg`;
}

function pickPrimaryImage(p: Product): { src: string; alt: string } | null {
  if (Array.isArray(p?.images) && p.images.length >= 2) {
    const it = p.images[0];
    const src = typeof it === 'string' ? it : it.src;
    const alt =
      typeof it === 'string'
        ? p?.name ?? 'Termékkép'
        : it.alt ?? p?.name ?? 'Termékkép';
    return src ? { src: toCardSrc(src), alt } : null;
  }
    // fallback: product.image
  if (p?.image) {
    if (typeof p.image === 'string') {
      return { src: p.image, alt: p?.name ?? 'Termékkép' };
    }
    if (typeof p.image === 'object' && p.image.src) {
      return {
        src: toCardSrc(p.image.src),
        alt: p.image.alt ?? p?.name ?? 'Termékkép',
      };
    }
  }
  return null;
}


function pickSecondaryImage(p: Product) {
  if (Array.isArray(p?.images) && p.images.length > 1) {
    const it = p.images[1]!;
    const src = typeof it === 'string' ? it : it?.src;
    const alt =
      typeof it === 'string'
        ? p?.name ?? 'Termékkép'
        : it?.alt ?? p?.name ?? 'Termékkép';
    return src ? { src: toCardSrc(src), alt } : null;
  }
  return null;
}

function formatHU(n: number) {
  return n.toLocaleString('hu-HU');
}

function computeUnitDiscount(
  unitPrice: number | undefined,
  discountPercent: number | null
) {
  if (typeof unitPrice !== 'number' || unitPrice <= 0) return null;
  if (discountPercent === null) return null;
  return Math.round(unitPrice * (1 - discountPercent / 100));
}

export default function DiscountCardClient({
  product,
  currentCategorySlug,
}: {
  product: Product;
  currentCategorySlug?: string;
}) {
  const primary = pickPrimaryImage(product);
  const secondary = pickSecondaryImage(product);

  const hasPrice = typeof product.price === 'number' && product.price > 0;

  const { hasDiscount, discountPrice, discountPercent } = computeDiscountForCard(product);
  const discountPercentView =
    typeof discountPercent === 'number' ? discountPercent : null;

  const pctForUnits =
    isDiscountActive(product) && hasValidPercent(product)
      ? product.discountPercent!
      : null;

  const discountMPrice  = computeUnitDiscount(product.mprice,  pctForUnits);
  const discountM2Price = computeUnitDiscount(product.m2price, pctForUnits);
  const discountM3Price = computeUnitDiscount(product.m3price, pctForUnits);
  const discountPalPrice= computeUnitDiscount(product.palprice,pctForUnits);

  const href = `/termekek/${currentCategorySlug || product.category || 'egyeb'}/${product.slug}`;

  return (
    <a
      href={href}
      class="py-2 group relative block border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition bg-white dark:bg-gray-800 dark:border-gray-700"
      aria-label={product.name}
    >
      {hasDiscount && (
        <div class="absolute top-2 left-2 bg-red-600 text-white text-sm font-bold px-2 py-1 rounded z-10 shadow">
          Akció
        </div>
      )}

      {hasDiscount && discountPercentView !== null && (
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
                  secondary ? 'group-hover:opacity-0' : ''
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
          {!product.variants ? (
            <>
              {hasPrice && (
                hasDiscount && discountPrice !== null ? (
                  <>
                    <p class="text-sm text-gray-500 line-through">
                      {formatHU(product.price!)} Ft / db
                    </p>
                    <p class="text-sm text-red-600 font-bold">
                      {formatHU(discountPrice)} Ft / db
                    </p>
                  </>
                ) : (
                  <p class="text-sm font-medium text-gray-800 dark:text-gray-300">
                    {formatHU(product.price!)} Ft / db
                  </p>
                )
              )}
            </>
          ) : (
            <>
              {hasPrice && (
                hasDiscount && discountPrice !== null ? (
                  <>
                    <p class="text-sm text-gray-500 line-through">
                      {formatHU(product.price!)} Ft / db-tól
                    </p>
                    <p class="text-sm text-red-600 font-bold">
                      {formatHU(discountPrice)} Ft / db-tól
                    </p>
                  </>
                ) : (
                  <p class="text-sm font-medium text-gray-800 dark:text-gray-300">
                    {formatHU(product.price!)} Ft / db-tól
                  </p>
                )
              )}
            </>
          )}

          {/* m ár */}
          {typeof product.mprice === 'number' && product.mprice > 0 && (
            discountMPrice !== null ? (
              <>
                <p class="text-sm text-gray-500 line-through">
                  {formatHU(product.mprice)} Ft / m
                </p>
                <p class="text-sm text-red-600 font-bold">
                  {formatHU(discountMPrice)} Ft / m
                </p>
              </>
            ) : (
              <p class="text-sm font-medium text-gray-800 dark:text-gray-300">
                {formatHU(product.mprice)} Ft / m
              </p>
            )
          )}

          {/* m² ár */}
          {typeof product.m2price === 'number' && product.m2price > 0 && (
            discountM2Price !== null ? (
              <>
                <p class="text-sm text-gray-500 line-through">
                  {formatHU(product.m2price)} Ft / m²
                </p>
                <p class="text-sm text-red-600 font-bold">
                  {formatHU(discountM2Price)} Ft / m²
                </p>
              </>
            ) : (
              <p class="text-sm font-medium text-gray-800 dark:text-gray-300">
                {formatHU(product.m2price)} Ft / m²
              </p>
            )
          )}

          {/* m³ ár */}
          {typeof product.m3price === 'number' && product.m3price > 0 && (
            discountM3Price !== null ? (
              <>
                <p class="text-sm text-gray-500 line-through">
                  {formatHU(product.m3price)} Ft / m³
                </p>
                <p class="text-sm text-red-600 font-bold">
                  {formatHU(discountM3Price)} Ft / m³
                </p>
              </>
            ) : (
              <p class="text-sm font-medium text-gray-800 dark:text-gray-300">
                {formatHU(product.m3price)} Ft / m³
              </p>
            )
          )}

          {/* raklap ár */}
          {typeof product.palprice === 'number' && product.palprice > 0 && (
            discountPalPrice !== null ? (
              <>
                <p class="text-sm text-gray-500 line-through">
                  {formatHU(product.palprice)} Ft / raklap
                </p>
                <p class="text-sm text-red-600 font-bold">
                  {formatHU(discountPalPrice)} Ft / raklap
                </p>
              </>
            ) : (
              <p class="text-sm font-medium text-gray-800 dark:text-gray-300">
                {formatHU(product.palprice)} Ft / raklap
              </p>
            )
          )}
        </div>
        
        {!product.variants ? (
          <>
            <div class="mt-1">
              {typeof product.stock === 'number' && product.stock > 0 ? (
                <span class="text-green-600">Raktáron</span>
              ) : (
                <span class="text-orange-500">Rendelhető (2-3 munkanap)</span>
              )}
            </div>
          </>
          ):(
          <>
            <div class="mt-1">
                <span class="text-green-600">Raktáron</span>
            </div>
          </>
          )
        }
        
      </div>
    </a>
  );
}
