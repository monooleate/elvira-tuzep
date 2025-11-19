import { useState } from "preact/hooks";
import ProductInteractiveBlock from '~/components/common/ProductInteractiveBlock.jsx';

interface Variant {
  id: string;
  title: string;
  price: number;
  sku?: string;
  variant_rank?: number,
  metadata?: {
    inventory?: number;
  };
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
  const ra = a.variant_rank ?? 9999
  const rb = b.variant_rank ?? 9999
  return ra - rb
})

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
          <table class="w-full border-collapse text-sm">
            <thead class="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              <tr>
                <th class="text-left p-3 w-12"></th>
                <th class="text-left p-3">Változat</th>
                <th class="text-left p-3">Bruttó ár</th>
                <th class="text-left p-3">Készlet</th>
              </tr>
            </thead>
            <tbody>
              {sortedVariants.map((variant) => (
                <tr
                  key={variant.id}
                  class={`border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 transition`}
                >
                  <td class="p-3 align-middle">
                    <input
                      type="radio"
                      name="variant"
                      value={variant.id}
                      checked={selectedVariant?.id === variant.id}
                      onChange={handleVariantChange}
                      class="accent-amber-600 dark:accent-amber-500 cursor-pointer"
                    />
                  </td>
                  <td class="p-3">{variant.title}</td>
                  <td class="p-3 font-semibold text-black-600">
                    {formatPrice(variant.price)} Ft
                  </td>
                  <td class="p-3">
                    {variant.metadata?.inventory && variant.metadata.inventory > 0 ? (
                      <span class="text-green-600">Raktáron</span>
                    ) : (
                      <span class="text-orange-600">Rendelhető</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ProductInteractiveBlock product={selectedVariant}/>
      </div>
    </>
  );
}
