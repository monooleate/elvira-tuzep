import { useState, useEffect, useRef, useMemo } from "preact/hooks";
import Fuse from "fuse.js";

import productsIndex from "../../data/index/products.index.json" with { type: "json" };

type MaybeNum = number | null;

interface IndexItem {
  slug: string;
  categorySlug: string;
  name: string | null;
  description?: string | null;

  sku: string | null;
  image: string | null;
  images?: any[] | null;

  priceFrom: MaybeNum;
  priceTo: MaybeNum;

  stock: number;          // ✅ nálad ez van
  hasDiscount: boolean;   // ✅ nálad ez van

  discountPercent: MaybeNum;
  discountValidUntil: string | null;

  variantTitles?: (string | null)[] | null;
  variantSkus?: (string | null)[] | null;
}

interface ProductDetail {
  slug: string;
  description?: string;
  variants?: any[] | null;
}

interface FlatProduct {
  name: string;
  description: string;
  sku: string;
  slug: string;

  // indexből
  basePrice: MaybeNum; // priceFrom
  priceTo: MaybeNum;

  // index akció (ha nincs hydrate)
  finalPrice: MaybeNum;
  hasDiscount: boolean;
  discountPercent: MaybeNum;
  discountEndsAt: Date | null;
  discountLabel: string | null;

  image: { src: string; alt: string };
  categorySlug: string;

  // hydrate után
  variants?: any[] | null;

  // készlet + variáns meta
  inStock: boolean;
  hasVariants: boolean;
  variantTitles: string[];
  variantSkus: string[];

  // ✅ itt a lényeg: single vs multi a variantTitles alapján
  isSingleByTitles: boolean;

  // ✅ variánsos akció/ár info (hydrate után)
  variantsMinOriginal?: MaybeNum;
  variantsMinFinal?: MaybeNum;
  variantsMaxFinal?: MaybeNum;
  variantsHasDiscount?: boolean;
  variantsMaxDiscountPercent?: MaybeNum;

  searchText: string;
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);
}

function computeHasVariantsFromIndex(i: IndexItem): boolean {
  const titles = toStringArray(i.variantTitles);
  const skus = toStringArray(i.variantSkus);

  // ✅ ha csak "Alap" van → NINCS variáns
  const isSingle = isSingleByVariantTitles(titles);

  // ha single "Alap", mindegy hány sku van (nálad 1) → false
  if (isSingle) return false;

  // ✅ ha több SKU van → biztos variánsos
  if (skus.length > 1) return true;

  // ✅ ha nem "Alap" és van cím (pl. Ø4mm x 30) → variánsos
  if (titles.length >= 1) return true;

  return false;
}

function computeInStockFromIndex(i: IndexItem): boolean {
  return typeof i.stock === "number" && i.stock > 0;
}


function normalizeForSearch(input: unknown): string {
  const s = String(input ?? "").toLowerCase().trim();

  const cleaned = s
    .replace(/[øØ]/g, "")
    .replace(/mm/g, "")
    .replace(/[×]/g, "x")
    .replace(/[,]/g, ".")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9x.]/g, "");

  return cleaned.replace(/[.]/g, "");
}

function buildSearchText(parts: unknown[]): string {
  return parts
    .flatMap((p) => (Array.isArray(p) ? p : [p]))
    .map(normalizeForSearch)
    .filter(Boolean)
    .join(" ");
}

function numOrNull(v: unknown): MaybeNum {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parseUntil(s?: string | null): Date | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T23:59:59");
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function computeDiscount(basePrice: MaybeNum, discountPercent: MaybeNum, discountValidUntil?: string | null) {
  const now = new Date();
  const discountEndsAt = parseUntil(discountValidUntil ?? null);
  const hasTimeValid = !!discountEndsAt && discountEndsAt.getTime() > now.getTime();

  const hasValidDiscountPercent =
    basePrice !== null &&
    discountPercent !== null &&
    discountPercent > 0 &&
    discountPercent < 100 &&
    hasTimeValid;

  const hasDiscount = !!hasValidDiscountPercent;

  const finalPrice: MaybeNum = (() => {
    if (basePrice === null) return null;
    if (hasValidDiscountPercent) return Math.round(basePrice * (1 - discountPercent! / 100));
    return basePrice;
  })();

  const discountLabel = hasValidDiscountPercent ? `-${Math.round(discountPercent!)}%` : null;

  return { hasDiscount, finalPrice, discountEndsAt, discountLabel };
}

function normalizeImagePath(p: unknown): string | null {
  const s = String(p ?? "").trim();
  if (!s) return null;

  // 1) külső URL-t hagyjuk
  if (/^https?:\/\//i.test(s)) return s;

  // 2) backslash → slash
  let out = s.replace(/\\/g, "/");

  // 3) ha relatív, kapjon vezető /
  if (!out.startsWith("/")) out = "/" + out;

  // 4) duplázott prefix javítás:
  //    /images/products//images/products/ -> /images/products/
  out = out.replace(/^\/images\/products\/+images\/products\/+/i, "/images/products/");

  // 5) extra: többszörös // -> /
  out = out.replace(/\/{2,}/g, "/");

  return out;
}


function pickImageSrc(item: IndexItem) {
  const fixed = normalizeImagePath(item.image);
  if (fixed) return fixed;
  return "/images/placeholder.png";
}

/** ✅ SINGLE logika: ha csak "Alap" van → single */
function isSingleByVariantTitles(titles: string[]) {
  if (!Array.isArray(titles) || titles.length === 0) return true;
  if (titles.length === 1 && titles[0].trim().toLowerCase() === "alap") return true;
  return false;
}

/** --------- Variáns-akció számítás (ProductCard-szerű) --------- */

type VariantForDiscount = {
  price?: number | null;
  discountPrice?: number | null;
  discountPercent?: number | null;
  discountValidUntil?: string | null;
  stock?: number | null;
  metadata?: { inventory?: number | null } | null;
};

function computeVariantFinalPrice(v: VariantForDiscount): {
  original: MaybeNum;
  final: MaybeNum;
  hasDiscount: boolean;
  pct: MaybeNum;
} {
  const original = numOrNull(v.price);

  const now = new Date();
  const ends = parseUntil(v.discountValidUntil ?? null);
  const timeValid = !!ends && ends.getTime() > now.getTime();

  // 1) discountPrice elsőbbség (ha időben érvényes)
  const dp = numOrNull(v.discountPrice);
  if (original !== null && dp !== null && dp > 0 && timeValid) {
    const pct = original > 0 ? Math.round((1 - dp / original) * 100) : null;
    return { original, final: dp, hasDiscount: true, pct };
  }

  // 2) discountPercent (ha időben érvényes)
  const pct = numOrNull(v.discountPercent);
  if (original !== null && pct !== null && pct > 0 && pct < 100 && timeValid) {
    const final = Math.round(original * (1 - pct / 100));
    return { original, final, hasDiscount: true, pct: Math.round(pct) };
  }

  return { original, final: original, hasDiscount: false, pct: null };
}

function computeVariantsPriceInfo(variants: any[] | null | undefined) {
  const list = Array.isArray(variants) ? variants : [];
  if (list.length === 0) {
    return {
      hasAnyDiscount: false,
      minOriginal: null as MaybeNum,
      minFinal: null as MaybeNum,
      maxFinal: null as MaybeNum,
      maxDiscountPercent: null as MaybeNum,
    };
  }

  const computed = list
    .map((v) => computeVariantFinalPrice(v as VariantForDiscount))
    .filter((x) => typeof x.final === "number" && x.final! > 0);

  const finals = computed.map((x) => x.final!) as number[];
  const originals = computed
    .map((x) => x.original)
    .filter((n): n is number => typeof n === "number" && n > 0);

  const minFinal = finals.length ? Math.min(...finals) : null;
  const maxFinal = finals.length ? Math.max(...finals) : null;
  const minOriginal = originals.length ? Math.min(...originals) : null;

  const hasAnyDiscount = computed.some((x) => x.hasDiscount);
  const maxDiscountPercent = computed.reduce((m, x) => Math.max(m, x.pct ?? 0), 0) || null;

  return { hasAnyDiscount, minOriginal, minFinal, maxFinal, maxDiscountPercent };
}

function normalizeIndexItem(i: IndexItem): FlatProduct {
  const name = typeof i.name === "string" ? i.name : "";
  const sku = typeof i.sku === "string" ? i.sku : "";
  const slug = i.slug;
  const categorySlug = i.categorySlug;

  const basePrice = numOrNull(i.priceFrom);
  const priceTo = numOrNull(i.priceTo);

  const discountPercent = numOrNull(i.discountPercent);

  // ✅ index alapú akció (minden terméknél működik, variánsosnál is "Ft-tól")
  const dFrom = computeDiscount(basePrice, discountPercent, i.discountValidUntil ?? null);
  const dTo = computeDiscount(priceTo, discountPercent, i.discountValidUntil ?? null);

  const imgSrc = pickImageSrc(i);
  const image = { src: imgSrc, alt: name || "Termékkép" };

  const variantTitles = toStringArray(i.variantTitles);
  const variantSkus = toStringArray(i.variantSkus);

  const isSingle = isSingleByVariantTitles(variantTitles);
  const hasVariants = computeHasVariantsFromIndex(i);
  const inStock = computeInStockFromIndex(i);

  const searchText = buildSearchText([name, sku, variantTitles, variantSkus]);

  return {
    name,
    description: typeof (i as any).description === "string" ? (i as any).description : "",
    sku,
    slug,

    basePrice,              // priceFrom
    priceTo,                // priceTo

    // ✅ itt most a "from" akciós finalPrice
    finalPrice: dFrom.finalPrice,
    hasDiscount: dFrom.hasDiscount,              // indexből számolva (nem i.hasDiscount)
    discountPercent,
    discountEndsAt: dFrom.discountEndsAt,
    discountLabel: dFrom.discountLabel,

    image,
    categorySlug,
    variants: null,

    inStock,
    hasVariants,

    variantTitles,
    variantSkus,

    isSingleByTitles: isSingle,

    // ✅ (opcionális) ha akarod a "to" akciós árát is:
    variantsMinOriginal: basePrice,
    variantsMinFinal: dFrom.finalPrice,
    variantsMaxFinal: dTo.finalPrice, // ha nincs, null marad
    variantsHasDiscount: dFrom.hasDiscount,
    variantsMaxDiscountPercent: dFrom.hasDiscount ? discountPercent : null,

    searchText,
  };
}


async function loadProductDetail(productSlug: string): Promise<ProductDetail | null> {
  try {
    const mod = await import(`../../data/products/${productSlug}.json`);
    return (mod?.default ?? mod) as ProductDetail;
  } catch {
    return null;
  }
}

export default function SearchWidget() {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const flatProducts: FlatProduct[] = useMemo(() => {
    return (productsIndex as IndexItem[]).map((i) => normalizeIndexItem(i));
  }, []);

  const fuse = useMemo(() => {
    return new Fuse(flatProducts, {
      keys: ["name", "sku", "variantTitles", "variantSkus", "searchText"],
      threshold: 0.3,
      ignoreLocation: true,
      minMatchCharLength: 2,
      includeScore: true,
    });
  }, [flatProducts]);

  useEffect(() => {
    const q = query.trim();
    if (q.length > 1) {
      try {
        const r = fuse.search(q);
        setResults(r);
      } catch (e) {
        console.error("Fuse search error:", e);
        setResults([]);
      }
    } else {
      setResults([]);
    }
  }, [query, fuse]);

  // Top találatokhoz leírás + variants lazy (max 10)
  useEffect(() => {
    let cancelled = false;

    async function hydrateTop() {
      const top = results.slice(0, 10).map((x: any) => x.item as FlatProduct);
      if (top.length === 0) return;

      const updates = await Promise.all(
        top.map(async (p) => {
          const detail = await loadProductDetail(p.slug);
          return { slug: p.slug, detail };
        })
      );

      if (cancelled) return;

      setResults((prev) =>
        prev.map((r: any) => {
          const item = r.item as FlatProduct;
          const found = updates.find((u) => u.slug === item.slug);
          if (!found?.detail) return r;

          const nextVariants = found.detail.variants ?? item.variants;
          const vinfo = computeVariantsPriceInfo(nextVariants);

          return {
            ...r,
            item: {
              ...item,
              description:
                typeof found.detail.description === "string"
                  ? found.detail.description
                  : item.description,
              variants: nextVariants,

              // ✅ variánsos akció/ár logika
              variantsMinOriginal: vinfo.minOriginal,
              variantsMinFinal: vinfo.minFinal,
              variantsMaxFinal: vinfo.maxFinal,
              variantsHasDiscount: vinfo.hasAnyDiscount,
              variantsMaxDiscountPercent: vinfo.maxDiscountPercent,
            },
          };
        })
      );
    }

    hydrateTop();

    return () => {
      cancelled = true;
    };
  }, [results.length]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q && q.trim().length > 1) {
      setQuery(q);
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (query.trim().length > 0) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", url.toString());
  }, [query]);

  const closeModal = () => {
    setIsOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("q");
    window.history.replaceState({}, "", url.toString());
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleEsc);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleEsc);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div class="relative max-h-[90vh] overflow-y-auto">
      <button
        class="text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white"
        onClick={() => {
          setIsOpen(true);
          const url = new URL(window.location.href);
          if (!url.searchParams.has("q")) {
            url.searchParams.set("q", "");
            window.history.replaceState({}, "", url.toString());
          }
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        aria-label="Keresés"
      >
        <div class="p-2 rounded-full bg-white hover:bg-gray-100 shadow dark:bg-gray-800 dark:hover:bg-gray-700 transition">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            ref={containerRef}
            class="bg-white dark:bg-gray-900 w-full max-w-xl rounded-lg shadow-lg p-6 relative max-h-[90vh] overflow-y-auto"
          >
            <button
              class="absolute top-[8px] right-2 text-gray-500 hover:text-black dark:hover:text-white"
              onClick={closeModal}
            >
              ✖️
            </button>

            <input
              ref={inputRef}
              type="text"
              placeholder="Keresés a termékek között..."
              value={query}
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
              class="w-full border border-gray-300 dark:border-gray-600 rounded px-4 py-2 my-4 bg-white dark:bg-gray-800 text-black dark:text-white"
            />

            <ul>
              {results.map(({ item }: { item: FlatProduct }) => {
                const inStock = item.inStock;

                // ✅ MULTI csak akkor, ha van variáns ÉS nem "Alap" single
                const isMulti = item.hasVariants && !item.isSingleByTitles;

                return (
                  <li key={item.slug} class="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                    <a
                      href={`/termekek/${item.categorySlug}/${item.slug}`}
                      class="flex items-center gap-4 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded"
                      onClick={closeModal}
                    >
                      <img
                        src={item.image.src}
                        alt={item.image.alt}
                        class="w-16 h-16 object-cover rounded"
                      />
                      <div>
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                          {item.name || "Névtelen termék"}
                        </h3>

                        {item.description && (
                          <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {item.description}
                          </p>
                        )}

                        <p class="text-sm text-gray-700 dark:text-gray-300 font-medium">
                          {/* ✅ MULTI variánsos megjelenítés (Ft-tól + variáns akció) */}
                          {isMulti ? (
                            <>
                              <span class="text-green-600 dark:text-green-400 mr-2">
                                {inStock ? "Raktáron -" : "Előrendelés -"}
                              </span>

                              {(() => {
                                const minFinal = item.variantsMinFinal ?? item.basePrice;
                                const minOriginal = item.variantsMinOriginal ?? item.basePrice;
                                const hasDisc = item.variantsHasDiscount === true;

                                if (minFinal === null) return <>Ár kérésre</>;

                                return (
                                  <>
                                    {hasDisc && minOriginal !== null && minOriginal > minFinal ? (
                                      <>
                                        <span class="inline-block bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded mr-2">
                                          Akció
                                        </span>
                                        <span class="mr-2 text-gray-500 dark:text-gray-400">
                                          {minOriginal.toLocaleString("hu-HU")} Ft-tól
                                        </span>
                                        {typeof item.variantsMaxDiscountPercent === "number" && item.variantsMaxDiscountPercent > 0 && (
                                          <span class="ml-2 text-green-600 dark:text-green-400">
                                            Akár -{Math.round(item.variantsMaxDiscountPercent)}%
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <span class="font-semibold">
                                        {minFinal.toLocaleString("hu-HU")} Ft-tól
                                      </span>
                                    )}

                                    {item.variantsMaxFinal !== null &&
                                    item.variantsMaxFinal !== undefined &&
                                    minFinal !== null &&
                                    item.variantsMaxFinal !== minFinal ? (
                                      <span class="ml-2 text-gray-600 dark:text-gray-400">
                                        {item.variantsMaxFinal.toLocaleString("hu-HU")} Ft-ig
                                      </span>
                                    ) : null}
                                  </>
                                );
                              })()}
                            </>
                          ) : (
                            /* ✅ SINGLE (nem multi): ugyanaz a logika, mint a sima terméknél */
                            <>
                              {inStock ? (
                                item.finalPrice !== null ? (
                                  item.hasDiscount ? (
                                    <>
                                      <span class="text-green-600 dark:text-green-400 mr-2">Raktáron</span>
                                      <span class="inline-block bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded mr-2">
                                        Akció
                                      </span>
                                      <span class="line-through mr-2 text-gray-500 dark:text-gray-400">
                                        {item.basePrice?.toLocaleString("hu-HU")} Ft
                                      </span>
                                      <span class="text-red-600 dark:text-red-400 font-semibold">
                                        {item.finalPrice.toLocaleString("hu-HU")} Ft
                                      </span>
                                      {item.discountLabel && (
                                        <span class="ml-2 text-green-600 dark:text-green-400">
                                          {item.discountLabel}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <span class="text-green-600 dark:text-green-400 mr-2">Raktáron -</span>
                                      {item.finalPrice.toLocaleString("hu-HU")} Ft
                                    </>
                                  )
                                ) : (
                                  "Raktáron – Ár kérésre"
                                )
                              ) : (
                                item.finalPrice !== null
                                  ? `Előrendelés – ${item.finalPrice.toLocaleString("hu-HU")} Ft`
                                  : "Előrendelés – Ár kérésre"
                              )}
                            </>
                          )}
                        </p>
                      </div>
                    </a>
                  </li>
                );
              })}

              {query.trim().length > 1 && results.length === 0 && (
                <li class="text-center text-gray-500 dark:text-gray-400">Nincs találat</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
