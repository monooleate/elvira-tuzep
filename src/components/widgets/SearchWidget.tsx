import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import Fuse from 'fuse.js';
import productsData from '../../data/products.json';

interface Product {
  name?: string;
  description?: string;
  image?: string | { src?: string; alt?: string };
  images?: Array<{ src: string; alt?: string }>;
  price?: number;
  slug?: string;
  stock?: number;
  sku?: string;
}

interface Category {
  slug: string;
  category: string;
  products: Product[];
}

type FlatProduct = Required<Product> & {
  categorySlug: string;
  categoryName: string;
};

function normalizeItem(p: Product, cat: Category): FlatProduct {
  const name = typeof p.name === 'string' ? p.name : '';
  const description = typeof p.description === 'string' ? p.description : '';
  const sku = typeof p.sku === 'string' ? p.sku : '';
  const slug = typeof p.slug === 'string' ? p.slug : `${cat.slug}-${sku || name}`.toLowerCase().replace(/\s+/g, '-');
  const stock = Number.isFinite(p.stock as number) ? (p.stock as number) : 0;
  const price = Number.isFinite(p.price as number) ? (p.price as number) : NaN;

  // prefer images[], fallback to image
  let images: Array<{ src: string; alt?: string }> = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
  if (images.length === 0) {
    if (p.image && typeof p.image === 'object' && (p.image as any).src) {
      images = [{ src: (p.image as any).src as string, alt: (p.image as any).alt || name }];
    } else if (typeof p.image === 'string') {
      images = [{ src: p.image as string, alt: name }];
    }
  }

  return {
    name,
    description,
    sku,
    slug,
    stock,
    price,
    images,
    image: p.image as any, // not used after normalize, but keep to satisfy type
    categorySlug: cat.slug,
    categoryName: cat.category,
  } as FlatProduct;
}

function safeImage(item: FlatProduct): { src: string; alt: string } {
  const img = item.images?.[0];
  if (img && img.src) return { src: `${img.src}-500.jpg`, alt: img.alt || item.name || 'Termékkép' };
  // Fallback placeholder (ha van saját placeholder pathod, cseréld)
  return { src: '/images/placeholder.png', alt: item.name || 'Termékkép' };
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
              class="absolute top-2 right-2 text-gray-500 hover:text-black dark:hover:text-white"
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
              class="w-full border border-gray-300 dark:border-gray-600 rounded px-4 py-2 mb-4 bg-white dark:bg-gray-800 text-black dark:text-white"
            />

            <ul>
              {results.map(({ item }: { item: FlatProduct }) => {
                const img = safeImage(item);
                const hasPrice = Number.isFinite(item.price);
                const inStock = Number.isFinite(item.stock) && item.stock > 0;
                return (
                  <li key={item.slug} class="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                    <a
                      href={`/termekek/${item.categorySlug}/${item.slug}`}
                      class="flex items-center gap-4 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded"
                      onClick={closeModal}
                    >
                      <img src={img.src} alt={img.alt} class="w-16 h-16 object-cover rounded" />
                      <div>
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{item.name || 'Névtelen termék'}</h3>
                        {item.description && (
                          <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{item.description}</p>
                        )}
                        <p class="text-sm text-gray-700 dark:text-gray-300 font-medium">
                          {inStock
                            ? hasPrice
                              ? `Raktáron – ${(+item.price).toLocaleString('hu-HU')} Ft`
                              : 'Raktáron – Ár kérésre'
                            : 'Előrendelés / Ajánlatkérés'}
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
