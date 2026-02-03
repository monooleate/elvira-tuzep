import { useState } from "preact/hooks";
import ProductInteractiveBlock from '~/components/common/ProductInteractiveBlock.jsx';
import { computeDiscountForCard, isDiscountActive, hasValidPercent } from '~/lib/discounts';

interface Variant {
  id: string;
  title: string;
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
}

interface Product {
  name: string;
  description?: string;
  variants?: Variant[];
}

interface Props {
  product: Product;
}

function formatPrice(value: number | null | undefined) {
  if (typeof value !== "number") return "";
  return value.toLocaleString("hu-HU");
}

export default function VariantTable({ product }: Props) {
  const variants = Array.isArray(product.variants) ? product.variants : [];

  // alapértelmezett variáns
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(
    variants.length > 0 ? variants[0] : null
  );

  function handleVariantChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const variantId = target.value;
    const found = variants.find((v) => v.id === variantId);
    if (found) setSelectedVariant(found);
  }

  const sortedVariants = [...variants].sort((a, b) => {
    const ra = a.variant_rank ?? 9999;
    const rb = b.variant_rank ?? 9999;
    return ra - rb;
  });

  // ha nincsenek variánsok → fallback
  if (variants.length === 0) {
    return (
      <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
        <h1 class="text-2xl font-bold mb-2">{product.name}</h1>
        <p class="text-gray-500 dark:text-gray-400">
          Nincs elérhető változat ehhez a termékhez.
        </p>
      </div>
    );
  }

  const selectedDiscount = selectedVariant ? computeDiscountForCard(selectedVariant) : null;

  // Százalékos akció a további árakhoz
  const pctForUnits = selectedVariant && isDiscountActive(selectedVariant) && hasValidPercent(selectedVariant)
    ? selectedVariant.discountPercent
    : null;

  return (
    <>
      <div>
        <h1 class="text-3xl font-bold mb-2">{product.name}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Cikkszám: {selectedVariant?.sku ?? "—"}
        </p>
        <br />
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          {product.description}
        </p>

        <div class="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-sm min-w-[500px]">
              <thead class="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                <tr>
                  <th class="text-left p-3 w-12"></th>
                  <th class="text-left p-3">Változat</th>
                  <th class="text-left p-3 whitespace-nowrap">Bruttó ár</th>
                  <th class="text-left p-3">Készlet</th>
                </tr>
              </thead>
              <tbody>
                {sortedVariants.map((variant) => {
                  const discount = computeDiscountForCard(variant);
                  const isSelected = selectedVariant?.id === variant.id;
                  
                  return (
                    <tr
                      key={variant.id}
                      class={`border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition ${
                        isSelected ? 'bg-amber-50 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      <td class="p-3 align-middle">
                        <input
                          type="radio"
                          name="variant"
                          value={variant.id}
                          checked={isSelected}
                          onChange={handleVariantChange}
                          class="accent-amber-600 dark:accent-amber-500 cursor-pointer"
                        />
                      </td>
                      <td class="p-3">
                        <div class="flex items-center gap-2">
                          <span>{variant.title}</span>
                          {discount.hasDiscount && discount.discountPercent && (
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white whitespace-nowrap">
                              -{discount.discountPercent}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td class="p-3 font-semibold">
                        {discount.hasDiscount && discount.discountPrice ? (
                          <div class="flex flex-col sm:flex-row sm:items-center gap-1">
                            <span class="line-through text-gray-500 text-xs sm:text-sm">
                              {formatPrice(variant.price)} Ft
                            </span>
                            <span class="text-red-600 font-bold whitespace-nowrap">
                              {formatPrice(discount.discountPrice)} Ft
                            </span>
                          </div>
                        ) : (
                          <span class="whitespace-nowrap">{formatPrice(variant.price)} Ft</span>
                        )}
                      </td>
                      <td class="p-3">
                        {variant?.stock && variant?.stock > 0 ? (
                          <span class="text-green-600 whitespace-nowrap">Raktáron</span>
                        ) : (
                          <span class="text-orange-600 whitespace-nowrap">Rendelhető</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kiválasztott variáns árainak megjelenítése */}
        {selectedVariant && (
          <div class="mt-6 space-y-3">
            {/* Darabár - mindig van */}
            {selectedDiscount?.hasPrice && (
              <div class="text-lg font-semibold">
                {selectedDiscount.hasDiscount && selectedDiscount.discountPrice ? (
                  <>
                    Bruttó ár:
                    <span class="line-through text-gray-500 mr-2 ml-2">
                      {formatPrice(selectedVariant.price)} Ft/db
                    </span>
                    <span class="text-red-600 font-bold">
                      {formatPrice(selectedDiscount.discountPrice)} Ft/db
                    </span>
                  </>
                ) : (
                  `Bruttó ár: ${formatPrice(selectedVariant.price)} Ft/db`
                )}
              </div>
            )}

            {/* Méterár */}
            {selectedVariant.mprice && typeof selectedVariant.mprice === 'number' && selectedVariant.mprice > 0 && (
              <div class="font-semibold text-gray-700 dark:text-gray-300">
                {pctForUnits ? (
                  <>
                    Méterár:
                    <span class="line-through text-gray-500 mr-2 ml-2">
                      {formatPrice(selectedVariant.mprice)} Ft/m
                    </span>
                    <span class="text-red-600 font-bold">
                      {formatPrice(Math.round(selectedVariant.mprice * (1 - pctForUnits / 100)))} Ft/m
                    </span>
                  </>
                ) : (
                  `Méterár: ${formatPrice(selectedVariant.mprice)} Ft/m`
                )}
              </div>
            )}

            {/* m² ár */}
            {selectedVariant.m2price && typeof selectedVariant.m2price === 'number' && selectedVariant.m2price > 0 && (
              <div class="font-semibold text-gray-700 dark:text-gray-300">
                {pctForUnits ? (
                  <>
                    Négyzetméterár:
                    <span class="line-through text-gray-500 mr-2 ml-2">
                      {formatPrice(selectedVariant.m2price)} Ft/m²
                    </span>
                    <span class="text-red-600 font-bold">
                      {formatPrice(Math.round(selectedVariant.m2price * (1 - pctForUnits / 100)))} Ft/m²
                    </span>
                  </>
                ) : (
                  `Négyzetméterár: ${formatPrice(selectedVariant.m2price)} Ft/m²`
                )}
              </div>
            )}

            {/* m³ ár */}
            {selectedVariant.m3price && typeof selectedVariant.m3price === 'number' && selectedVariant.m3price > 0 && (
              <div class="font-semibold text-gray-700 dark:text-gray-300">
                {pctForUnits ? (
                  <>
                    Köbméterár:
                    <span class="line-through text-gray-500 mr-2 ml-2">
                      {formatPrice(selectedVariant.m3price)} Ft/m³
                    </span>
                    <span class="text-red-600 font-bold">
                      {formatPrice(Math.round(selectedVariant.m3price * (1 - pctForUnits / 100)))} Ft/m³
                    </span>
                  </>
                ) : (
                  `Köbméterár: ${formatPrice(selectedVariant.m3price)} Ft/m³`
                )}
              </div>
            )}

            {/* Raklapár */}
            {selectedVariant.palprice && typeof selectedVariant.palprice === 'number' && selectedVariant.palprice > 0 && (
              <div class="font-semibold text-gray-700 dark:text-gray-300">
                {pctForUnits ? (
                  <>
                    Raklapár:
                    <span class="line-through text-gray-500 mr-2 ml-2">
                      {formatPrice(selectedVariant.palprice)} Ft/raklap
                    </span>
                    <span class="text-red-600 font-bold">
                      {formatPrice(Math.round(selectedVariant.palprice * (1 - pctForUnits / 100)))} Ft/raklap
                    </span>
                  </>
                ) : (
                  `Raklapár: ${formatPrice(selectedVariant.palprice)} Ft/raklap`
                )}
              </div>
            )}

            {/* Készlet */}
            <div>
              {selectedVariant.stock && selectedVariant.stock > 0 ? (
                <span class="text-green-600">Raktáron</span>
              ) : (
                <span class="text-orange-600">Rendelhető (2-3 munkanap)</span>
              )}
            </div>
          </div>
        )}

        <ProductInteractiveBlock product={selectedVariant} />
      </div>
    </>
  );
}
