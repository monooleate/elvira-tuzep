import { useState, useEffect, useRef } from 'preact/hooks';
import Fuse from 'fuse.js';
import productsData from '../../data/products.json';

interface Product {
  name: string;
  description: string;
  image: string;
  price: number;
  slug: string;
  stock: number;
  sku: string;
}

interface Category {
  slug: string;
  category: string;
  products: Product[];
}

export default function SearchWidget() {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // 🔸 Ref a teljes dobozra
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fuse = new Fuse(
    productsData.flatMap((cat: Category) =>
      cat.products.map((product) => ({
        ...product,
        categorySlug: cat.slug,
        categoryName: cat.category,
      }))
    ),
    {
      keys: ['name', 'description', 'sku'],
      threshold: 0.3,
    }
  );

  useEffect(() => {
    if (query.trim().length > 1) {
      setResults(fuse.search(query).slice(0, 6));
    } else {
      setResults([]);
    }
  }, [query]);

  // 🔸 ESC billentyűre és külső kattintásra figyelés
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
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
    <div class="relative">
      <button
        class="text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white"
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        aria-label="Keresés"
      >
        🔍
      </button>

      {isOpen && (
        <div class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div
            ref={containerRef}
            class="bg-white dark:bg-gray-900 w-full max-w-xl rounded-lg shadow-lg p-6 relative"
          >
            <button
              class="absolute top-2 right-2 text-gray-500 hover:text-black dark:hover:text-white"
              onClick={() => setIsOpen(false)}
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
              {results.map(({ item }) => (
                <li key={item.slug} class="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                  <a
                    href={`/termekek/${item.categorySlug}/${item.slug}`}
                    class="flex items-center gap-4 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded"
                    onClick={() => setIsOpen(false)}
                  >
                    <img src={item.image} alt={item.name} class="w-16 h-16 object-cover rounded" />
                    <div>
                      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{item.name}</h3>
                      <p class="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
                      <p class="text-sm text-gray-700 dark:text-gray-300 font-medium">
                        {item.stock > 0 ? `Raktáron – ${item.price.toLocaleString()} Ft` : 'Előrendelés / Ajánlatkérés'}
                      </p>
                    </div>
                  </a>
                </li>
              ))}
              {query.length > 1 && results.length === 0 && (
                <li class="text-center text-gray-500 dark:text-gray-400">Nincs találat</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
