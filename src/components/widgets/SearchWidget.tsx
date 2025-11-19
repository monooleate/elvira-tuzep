import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import Fuse from 'fuse.js';

import productsData from "../../data/products.json" with { type: "json" }

/* const productsData = await fetchCategoriesWithProducts() */

type MaybeNum = number | null;
type MaybeStr = string | null;

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
  name?: string;
  description?: string;
  image?: string | { src?: string; alt?: string };
  images?: Array<{ src: string; alt?: string }>;

  // ármezők
  price?: MaybeNum;
  mprice?: MaybeNum;
  m2price?: MaybeNum;
  m3price?: MaybeNum;
  palprice?: MaybeNum;

  // kedvezmény mezők a JSON-ban
  discountPrice?: MaybeNum;
  discountPercent?: MaybeNum;
  /** ISO dátum string pl. "2025-09-30" vagy "2025-09-30T23:59:59Z" */
  discountValidUntil?: string | null;

  

  slug?: string;
  stock?: number;
  sku?: string;
  variants?: Variant[];
}

interface Category {
  slug: string;
  category: string;
  products: Product[];
}

interface FlatProduct {
  name: string;
  description: string;
  sku: string;
  slug: string;
  stock: number;

  // ármezők normalizálva
  price: MaybeNum;
  mprice: MaybeNum;
  m2price: MaybeNum;
  m3price: MaybeNum;
  palprice: MaybeNum;

  // összegzett árinfók
  hasPrice: MaybeNum;     // első nem null ár
  basePrice: MaybeNum;    // alias: ugyanaz, csak beszédesebb
  finalPrice: MaybeNum;   // akció figyelembevételével
  hasDiscount: boolean;   // van-e érvényes akció most
  discountPrice: MaybeNum;
  discountPercent: MaybeNum;
  discountEndsAt: Date | null; // vége dátumként
  discountLabel: string | null; // pl. "-15%"

  // képek
  images: Array<{ src: string; alt?: string }>;
  image: { src: string; alt: string };

  categorySlug: string;
  categoryName: string;
  variants?: Variant[];
}

const PRICE_ORDER = ['price', 'mprice', 'm2price', 'm3price', 'palprice'] as const;

function normalizeItem(p: Product, cat: Category): FlatProduct {
  const name = typeof p.name === 'string' ? p.name : '';
  const description = typeof p.description === 'string' ? p.description : '';
  const sku = typeof p.sku === 'string' ? p.sku : '';
  const slug =
    typeof p.slug === 'string'
      ? p.slug
      : `${cat.slug}-${(sku || name).toLowerCase().trim().replace(/\s+/g, '-')}`;

  const stock = Number.isFinite(p.stock as number) ? (p.stock as number) : 0;

  const numOrNull = (v: unknown): MaybeNum =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;

  // ── ármezők ─────────────────────────────────────────────
  const price: MaybeNum    = numOrNull(p.price);
  const mprice: MaybeNum   = numOrNull(p.mprice);
  const m2price: MaybeNum  = numOrNull(p.m2price);
  const m3price: MaybeNum  = numOrNull(p.m3price);
  const palprice: MaybeNum = numOrNull(p.palprice);

  const basePrice: MaybeNum =
    price ?? mprice ?? m2price ?? m3price ?? palprice ?? null;

  // ── kedvezmény logika ──────────────────────────────────
  const discountPrice = numOrNull(p.discountPrice);
  const discountPercent = numOrNull(p.discountPercent);

  // Dátum parszer: ha csak "YYYY-MM-DD" formátum jön, kezeld a nap végéig (23:59:59)
  const parseUntil = (s?: string | null): Date | null => {
    if (!s) return null;
    // egyszerű YYYY-MM-DD minta
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s + 'T23:59:59');
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const now = new Date();
  const discountEndsAt = parseUntil(p.discountValidUntil ?? null);
  const hasTimeValid = !!discountEndsAt && discountEndsAt.getTime() > now.getTime();

  const hasValidDiscountPrice =
    basePrice !== null &&
    discountPrice !== null &&
    discountPrice > 0 &&
    discountPrice < basePrice &&
    hasTimeValid;

  const hasValidDiscountPercent =
    basePrice !== null &&
    discountPercent !== null &&
    discountPercent > 0 &&
    discountPercent < 100 &&
    hasTimeValid;

  const hasDiscount = !!(hasValidDiscountPrice || hasValidDiscountPercent);

  const finalPrice: MaybeNum = (() => {
    if (basePrice === null) return null;
    if (hasValidDiscountPrice) return discountPrice!;
    if (hasValidDiscountPercent) return Math.round(basePrice * (1 - discountPercent! / 100));
    return basePrice;
  })();

  const discountLabel =
    hasValidDiscountPercent ? `-${Math.round(discountPercent!)}%` :
    hasValidDiscountPrice && basePrice !== null
      ? `-${Math.round(100 - (discountPrice! / basePrice) * 100)}%`
      : null;

  // ── képek ──────────────────────────────────────────────
  let images: Array<{ src: string; alt?: string }> = []

  // 1️⃣ Ha van images[] és nem üres
  if (Array.isArray(p.images) && p.images.length > 0) {
    images = p.images.filter(
      (img) => img && typeof img.src === "string" && img.src.trim() !== ""
    )
  }

  // 2️⃣ Ha nincs vagy üres → próbáljuk az image mezőt
  if (images.length === 0) {
    if (p.image && typeof p.image === "object" && (p.image as any).src) {
      images = [{ src: (p.image as any).src as string, alt: (p.image as any).alt || name }]
    } else if (typeof p.image === "string" && p.image.trim() !== "") {
      images = [{ src: p.image as string, alt: name }]
    }
  }

  // 3️⃣ Ha az is hiányzik → placeholder
  if (images.length === 0) {
    images = [{ src: "/images/placeholder.png", alt: name || "Termékkép" }]
  }

  // 4️⃣ Elsődleges kép kiválasztása
  let main = images[0]
  let imgSrc = main.src

  // ➕ Csak akkor fűzzük hozzá a -500.jpg-t, ha:
  //    - az images tömbből jön (nem az image mezőből),
  //    - és a src NEM végződik .jpg / .png / .webp kiterjesztéssel
  const cameFromImages = Array.isArray(p.images) && p.images.length > 0
  const hasExtension = /\.(jpg|jpeg|png|webp)$/i.test(imgSrc)

  if (cameFromImages && !hasExtension) {
    imgSrc = `${imgSrc}-500.jpg`
  }

  const image = { src: imgSrc, alt: main.alt || name || "Termékkép" }

  return {
    name,
    description,
    sku,
    slug,
    stock,

    price,
    mprice,
    m2price,
    m3price,
    palprice,

    hasPrice: basePrice,
    basePrice,
    finalPrice,
    hasDiscount,
    discountPrice,
    discountPercent,
    discountEndsAt,
    discountLabel,

    images,
    image,

    categorySlug: cat.slug,
    categoryName: cat.category,
    variants: p.variants
  };
}

export default function SearchWidget() {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);


  
  // Laposított és normalizált terméklista
  const flatProducts: FlatProduct[] = useMemo(() => {
    return (productsData as Category[]).flatMap((cat) =>
      (cat.products || []).map((p) => normalizeItem(p, cat))
    );
  }, []);

  // Fuse példány (memózva)
  const fuse = useMemo(() => {
    return new Fuse(flatProducts, {
      keys: ['name', 'description', 'sku'],
      threshold: 0.3,
      ignoreLocation: true,
      minMatchCharLength: 2,
      includeScore: true,
    });
  }, [flatProducts]);

  // Keresés
  useEffect(() => {
    const q = query.trim();
    if (q.length > 1) {
      try {
        const r = fuse.search(q);
        setResults(r);
      } catch (e) {
        console.error('Fuse search error:', e);
        setResults([]);
      }
    } else {
      setResults([]);
    }
  }, [query, fuse]);

  // ?q beolvasása
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q && q.trim().length > 1) {
      setQuery(q);
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, []);

  // URL szinkron
  useEffect(() => {
    const url = new URL(window.location.href);
    if (query.trim().length > 0) {
      url.searchParams.set('q', query);
    } else {
      url.searchParams.delete('q');
    }
    window.history.replaceState({}, '', url.toString());
  }, [query]);

  const closeModal = () => {
    setIsOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    window.history.replaceState({}, '', url.toString());
  };

  // ESC & outside click
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

/*   console.log(results) */

  return (
    <div class="relative max-h-[90vh] overflow-y-auto">
      <button
        class="text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white"
        onClick={() => {
          setIsOpen(true);
          const url = new URL(window.location.href);
          if (!url.searchParams.has('q')) {
            url.searchParams.set('q', '');
            window.history.replaceState({}, '', url.toString());
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
                const img = item;

              // Első nem null/undefined ár érték
                const v =
                  item.price ??
                  item.mprice ??
                  item.m2price ??
                  item.m3price ??
                  item.palprice;

                const hasPrice: number | null =
                  typeof v === "number" && Number.isFinite(v) ? v : null;

                const inStock = Number.isFinite(item.stock) && item.stock > 0;
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
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{item.name || 'Névtelen termék'}</h3>
                        {item.description && (
                          <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{item.description}</p>
                        )}
                        <p class="text-sm text-gray-700 dark:text-gray-300 font-medium">
                          {!item.variants ? (
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
                            `Előrendelés – ${item.finalPrice.toLocaleString("hu-HU")} Ft`
                          )}
                            </>
                          ) : (
                            <> 
                            <span class="text-green-600 dark:text-green-400 mr-2">Raktáron -</span>
                            {`${item.variants[0].price.toLocaleString("hu-HU")} Ft-tól`}
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
