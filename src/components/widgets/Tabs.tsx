// src/components/Tabs.tsx
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

type Category = {
  slug: string;
  category: string;
  description?: string;
  maincategory?: string;
  meta?: {
    image?: string;
    description?: string;
    title?: string;
  };
};

type TabIntro = {
  title?: string;
  body: string;
  image?: string; // opcionális hero/thumbnail
};

type Props = {
  categories: Category[];
  /** Olyan fix/sticky fejlécek szelektorai, amik felül takarnak (pl. '#header') */
  headerSelectors?: string[];
  /** Ha a sticky tabs sávnak külső id-t adsz, itt megadhatod; egyébként a belsőt használja */
  stickyBarId?: string;
  /** Kezdő fül neve; ha nincs, az első főkategória */
  initialTabName?: string;
  /** ÚJ: főkategória -> bevezető doboz (sticky alá) */
  tabIntros?: Record<string, TabIntro>;
};

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/\-+/g, '-')
    .replace(/^\-|\-$/g, '');

export default function Tabs({
  categories,
  headerSelectors = ['#header'],
  stickyBarId,
  initialTabName,
  tabIntros = {},
}: Props) {
  // biztonságos adat (hiányzó maincategory -> "Egyéb")
  const safeData = useMemo(
    () =>
      (Array.isArray(categories) ? categories : []).map((c) => ({
        ...c,
        maincategory: c.maincategory?.trim() || 'Egyéb',
      })),
    [categories]
  );

  const mainTabs = useMemo(() => {
    const set = new Set<string>();
    safeData.forEach((c) => set.add(c.maincategory!));
    return set.size ? Array.from(set) : ['Egyéb'];
  }, [safeData]);

  const [active, setActive] = useState<string>(
    initialTabName && mainTabs.includes(initialTabName) ? initialTabName : mainTabs[0]
  );

  const grouped = useMemo(
    () =>
      mainTabs.map((name) => ({
        name,
        items: safeData.filter((c) => c.maincategory === name),
      })),
    [mainTabs, safeData]
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const internalBarRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const panelsRef = useRef<Map<string, HTMLElement>>(new Map());
  const isScrollingRef = useRef(false);
  const introRef = useRef<HTMLDivElement | null>(null);

  // sticky bar referencia beállítás
  useEffect(() => {
    if (stickyBarId) {
      barRef.current = document.getElementById(stickyBarId) as HTMLDivElement | null;
    } else {
      barRef.current = internalBarRef.current;
    }
  }, [stickyBarId]);

  const toId = (s: string) => `tab-${slugify(s)}`;

  // Összesített offset (fix headerek + sticky top + sticky bar magasság)
  const getCombinedOffset = () => {
    // fejlécek magasságainak összege
    const headersHeight = headerSelectors.reduce((acc, sel) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      return acc + (el ? el.getBoundingClientRect().height : 0);
    }, 0);

    // sticky sáv top + magasság
    let stickyTop = 0;
    let barH = 0;
    const bar = barRef.current;
    if (bar) {
      const cs = getComputedStyle(bar);
      stickyTop = parseFloat(cs.top || '0') || 0;
      /* barH = bar.getBoundingClientRect().height; */
    }
    return Math.round(headersHeight + stickyTop + barH - 30);
  };

  const scrollToIntro = () => {
    const el = introRef.current;
    if (!el) return;

    const offset = getCombinedOffset();
    const rect = el.getBoundingClientRect();
    const absoluteTop = window.scrollY + rect.top - offset - 10;

    window.scrollTo({
      top: absoluteTop,
      behavior: 'smooth',
    });
  };

  // ÚJ: görgetés az intro doboz tetejére
  const scrollToIntroIfNeeded = () => {
    const el = introRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      const offset = getCombinedOffset();
      el.style.scrollMarginTop = `${offset}px`;

      const THRESHOLD = 20;
      const topInViewport = el.getBoundingClientRect().top;
      if (Math.abs(topInViewport - offset) <= THRESHOLD) return;

      if (isScrollingRef.current) return;
      isScrollingRef.current = true;

      el.scrollIntoView({ block: 'start', behavior: 'smooth' });

      const clear = () => {
        isScrollingRef.current = false;
        window.removeEventListener('scrollend', clear);
      };
      if ('onscrollend' in window) {
        window.addEventListener('scrollend', clear, { once: true } as any);
      } else {
        setTimeout(clear, 400);
      }
    });
  };

  // MÓDOSÍTOTT: először intro-ra próbál, ha nincs, panelre
  const scrollToActiveStart = (name: string) => {
    if (tabIntros[name]) {
      // van intro ehhez a tabhoz → oda görgetünk
      // fontos: az intro az állapotváltás után renderelődik, ezért várunk egy frame-et
      requestAnimationFrame(() => scrollToIntro());
    } else {
      // nincs intro → visszaesünk a panel tetejére
      scrollToPanelTopIfNeeded(name);
    }
  };

  // Abszolút görgetés a panel tetejére, scrollIntoView + scrollMarginTop
  const scrollToPanelTopIfNeeded = (name: string) => {
    const panel = panelsRef.current.get(name);
    if (!panel) return;

    // Várjunk egy frame-et, hogy a layout stabilizálódjon (tabs esetleg két sor)
    requestAnimationFrame(() => {
      const offset = getCombinedOffset();
      panel.style.scrollMarginTop = `${offset}px`;

      // Ha már közel jó helyen van, ne görgessünk
      const THRESHOLD = 20;
      const topInViewport = panel.getBoundingClientRect().top;
      if (Math.abs(topInViewport - offset) <= THRESHOLD) return;

      if (isScrollingRef.current) return;
      isScrollingRef.current = true;

      panel.scrollIntoView({ block: 'start', behavior: 'smooth' });

      const clear = () => {
        isScrollingRef.current = false;
        window.removeEventListener('scrollend', clear);
      };
      // scrollend fallback
      if ('onscrollend' in window) {
        window.addEventListener('scrollend', clear, { once: true } as any);
      } else {
        setTimeout(clear, 400);
      }
    });
  };

  // Reszponzív: offset frissítés ablakméret változásra
  useEffect(() => {
    const onResize = () => {
      const panel = panelsRef.current.get(active);
      const offset = getCombinedOffset();
      if (panel) panel.style.scrollMarginTop = `${offset}px`;
      if (introRef.current) introRef.current.style.scrollMarginTop = `${offset}px`;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, headerSelectors]);

  // ---- ÚJ: bevezető doboz tartalom az aktív fülhöz
  const activeIntro: TabIntro | undefined = tabIntros[active];

  return (
    <div ref={rootRef} class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 class="text-3xl font-bold text-gray-900 dark:text-white pt-6 pb-4 text-center">
        Termékkategóriák
      </h2>
      {/* Sticky, középre igazított, több sorba törő tabs */}
      <div
        ref={internalBarRef}
        id={stickyBarId}
        class="sticky top-[calc(env(safe-area-inset-top)+72px)] xl:top-[calc(env(safe-area-inset-top)+94px)] z-30 bg-gray-50/90 dark:bg-gray-900/80 backdrop-blur"
        role="tablist"
        aria-label="Főkategóriák"
      >
        <div class="px-4">
          <div class="flex flex-wrap justify-center gap-2 py-2">
            {mainTabs.map((name) => {
              const isActive = name === active;
              return (
                <button
                  id={toId(name)}
                  type="button"
                  role="tab"
                  aria-selected={isActive ? 'true' : 'false'}
                  aria-controls={`panel-${toId(name)}`}
                  data-tab={name}
                  onClick={() => {
                    setActive(name);
                    requestAnimationFrame(() => scrollToActiveStart(name));
                  }}
                  class={`px-4 py-2 rounded-full text-sm font-medium transition border whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-500
                    ${
                      isActive
                        ? 'bg-orange-500 hover:bg-orange-600 text-white border-transparent shadow'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ÚJ: Sticky alatti bevezető doboz (ugyanaz a vizuális nyelv, mint a termékkártya) */}
      {activeIntro && (
        <div
          ref={introRef}           // ← IDE a ref
          class="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm bg-white dark:bg-gray-800"
          aria-live="polite"
        >
          {activeIntro.image && (
            <img
              src={activeIntro.image}
              alt={activeIntro.title || active}
              class="w-full h-40 object-cover"
              loading="lazy"
              decoding="async"
            />
          )}
          <div class="p-4">
            {activeIntro.title && (
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {activeIntro.title}
              </h3>
            )}
            <p class="text-sm text-gray-700 dark:text-gray-300">
              {activeIntro.body}
            </p>
          </div>
        </div>
      )}

      {/* Panelek */}
      {grouped.map(({ name, items }) => (
        <section
          id={`panel-${toId(name)}`}
          role="tabpanel"
          aria-labelledby={toId(name)}
          data-panel={name}
          ref={(el) => el && panelsRef.current.set(name, el)}
          class={`${name === active ? '' : 'hidden'}`}
        >
          <div class="py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 motion-safe:md:opacity-0 motion-safe:md:intersect:animate-fade intersect-once intersect-quarter intercept-no-queue">
            {items.length === 0 ? (
              <div class="col-span-full text-sm text-gray-600 dark:text-gray-400">
                Nincs megjeleníthető kategória ebben a fülben.
              </div>
            ) : (
              items.map((category) => (
                <a
                  href={`/termekek/${category.slug}`}
                  class="block border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition bg-white dark:bg-gray-800"
                >
                  <img
                    src={category.meta?.image || '/placeholder.svg'}
                    alt={category.category}
                    class="w-full h-48 object-cover"
                    loading="lazy"
                  />
                  <div class="p-4">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                      {category.category}
                    </h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {category.meta?.description || category.description || ''}
                    </p>
                  </div>
                </a>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
