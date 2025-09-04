// src/components/MainCategoryGrid.tsx
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import DiscountCard from '~/components/widgets/DiscountCard.astro'

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
  image?: string;    // opcionális hero/thumbnail
  imageAlt?: string;
};

type Props = {
  categories: Category[];
  /** Olyan fix/sticky fejlécek szelektorai, amik felül takarnak (pl. '#header') */
  headerSelectors?: string[];
  /** Ha a sticky sávnak külső id-t adsz, itt megadhatod; egyébként a belsőt használja */
  stickyBarId?: string;
  /** Kezdő fül neve; ha nincs, az első főkategória */
  initialTabName?: string;
  /** főkategória -> bevezető doboz (sticky alá) */
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

export default function MainCategoryGrid({
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

  // Refs
  const rootRef = useRef<HTMLDivElement>(null);
  const internalBarRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const panelsRef = useRef<Map<string, HTMLElement>>(new Map());
  const isScrollingRef = useRef(false);
  const introRef = useRef<HTMLDivElement | null>(null);
  const gridTopRef = useRef<HTMLDivElement | null>(null);
  const gridBottomRef = useRef<HTMLDivElement | null>(null);

  const [showBackSticky, setShowBackSticky] = useState(true);
  const [showSubCategory, setShowSubCategory] = useState(false);

  // sticky bar referencia beállítás
  useEffect(() => {
    if (stickyBarId) {
      barRef.current = document.getElementById(stickyBarId) as HTMLDivElement | null;
    } else {
      barRef.current = internalBarRef.current;
    }
  }, [stickyBarId]);

  const toId = (s: string) => `tab-${slugify(s)}`;

  // Összesített offset (fix headerek + sticky top)
  const getCombinedOffset = () => {
    // fejlécek magasságainak összege
    const headersHeight = headerSelectors.reduce((acc, sel) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      return acc + (el ? el.getBoundingClientRect().height : 0);
    }, 0);
    // sticky sáv top (ha van top érték)
    let stickyTop = 0;
    const bar = barRef.current;
    if (bar) {
      const cs = getComputedStyle(bar);
      stickyTop = parseFloat(cs.top || '0') || 0;
    }
    // kis negatív korrekció, hogy szépen a sticky alá essen
    return Math.max(0, Math.round(headersHeight + stickyTop + 8));
  };

  const smoothScrollTo = (y: number) => {
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  const scrollToIntro = () => {
    const el = introRef.current;
    if (!el) return;
    const offset = getCombinedOffset();
    const rect = el.getBoundingClientRect();
    const absoluteTop = window.scrollY + rect.top - offset;
    smoothScrollTo(absoluteTop);
  };

  // Abszolút görgetés a panel tetejére (fallback, ha nincs intro)
  const scrollToPanelTopIfNeeded = (name: string) => {
    const panel = panelsRef.current.get(name);
    if (!panel) return;

    requestAnimationFrame(() => {
      const offset = getCombinedOffset();
      panel.style.scrollMarginTop = `${offset}px`;

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
      if ('onscrollend' in window) {
        window.addEventListener('scrollend', clear, { once: true } as any);
      } else {
        setTimeout(clear, 400);
      }
    });
  };

  // Csempék aljára ugrás
  const scrollToGridBottom = () => {
    const el = gridBottomRef.current;
    if (!el) return;
    const offset = getCombinedOffset();
    const rect = el.getBoundingClientRect();
    const absoluteTop = window.scrollY + rect.top - offset;
    smoothScrollTo(absoluteTop);
  };

  // Csempék tetejére ugrás (sticky „vissza”)
  const scrollToGridTop = () => {
    const el = gridTopRef.current;
    if (!el) return;
    const offset = getCombinedOffset();
    const rect = el.getBoundingClientRect();
    const absoluteTop = window.scrollY + rect.top - offset;
    smoothScrollTo(absoluteTop);
  };

  // MÓDOSÍTOTT: először csempék aljára, majd intro tetejére; ha nincs intro, panelre
  const scrollToActiveStart = (name: string) => {
    requestAnimationFrame(() => {
      scrollToGridBottom();
      if (tabIntros[name]) {
        // várunk egy frame-et, hogy az intro biztosan renderelődjön
        requestAnimationFrame(() => scrollToIntro());
      } else {
        scrollToPanelTopIfNeeded(name);
      }
    });
  };

  // Sticky „vissza” gomb láthatóság: ha a viewport már a csempe-rács alatt van
  useEffect(() => {
    const onScroll = () => {
      const bottom = gridBottomRef.current;
      if (!bottom) return;
      const bottomTop = bottom.getBoundingClientRect().top;
      // ha a bottom már feljebb került a headerhez képest, mutassuk a gombot
     // setShowBackSticky(bottomTop <= (headerSelectors.length ? 120 : 60));
     setShowSubCategory(bottomTop <= (headerSelectors.length ? 120 : 60));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [headerSelectors]);

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

  // Aktív intro
  const activeIntro: TabIntro | undefined = tabIntros[active];

  return (
    <div ref={rootRef} class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white pt-6 pb-4 text-center">
        Fő termékkategóriák
      </h1>

      {/* Főkategória csempék (képpel), tablist szemantikával */}
      <div
        ref={internalBarRef}
        id={stickyBarId}
        class="top-[calc(env(safe-area-inset-top)+72px)] xl:top-[calc(env(safe-area-inset-top)+94px)] z-30 bg-gray-50/90 dark:bg-gray-900/80 backdrop-blur"
        role="tablist"
        aria-label="Főkategóriák"
      >
        <div ref={gridTopRef} class="px-4 py-3">
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {mainTabs.map((name) => {
              const isActive = name === active;
              const id = toId(name);
              const intro = tabIntros[name];
              return (
                <div key={name} class="group">
                  <button
                    id={id}
                    type="button"
                    role="tab"
                    aria-selected={isActive ? 'true' : 'false'}
                    aria-controls={`panel-${toId(name)}`}
                    data-tab={name}
                    onClick={() => {
                      setActive(name);
                      requestAnimationFrame(() => scrollToActiveStart(name));
                    }}
                    class={`w-full text-left rounded-xl overflow-hidden border transition shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-500
                      ${isActive ? 'border-orange-500 ring-1 ring-orange-500' : 'border-gray-200 dark:border-gray-700 hover:shadow-md'}
                      bg-white dark:bg-gray-800`}
                  >
                    {/* Kép – csak ha van (nincs hálózati kérés, ha hiányzik) */}
                    <div class="w-full aspect-[4/3] overflow-hidden">
                      {intro?.image ? (
                        <img
                          src={intro.image}
                          alt={intro.imageAlt || name}
                          class="w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div class="w-full h-full bg-gray-100 dark:bg-gray-700" aria-hidden="true" />
                      )}
                    </div>
                    {/* Cím */}
                    <h2 class="p-3">
                      <span
                        class={`block text-sm font-semibold ${
                          isActive ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {name}
                      </span>
                    </h2>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Anchor a csempék alján – ide ugrunk kattintáskor */}
      <div ref={gridBottomRef} class="h-1" />

      {/* Sticky navigáció: vissza + aktuális főkategória jelző */}
      {showBackSticky && (
        <div class="sticky top-[calc(env(safe-area-inset-top)+72px)] z-40 dark:bg-gray-900/80 backdrop-blur">
          <div class="mx-auto max-w-6xl">
            <div class="flex flex-wrap items-center justify-center gap-2 py-2">
              {/* ⬆ Vissza a főkategóriákhoz */}
                <button
                    type="button"
                    onClick={scrollToGridTop}
                    class="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-orange-500 text-white text-sm font-medium shadow hover:bg-orange-600 active:scale-[.99]"
                    aria-label="Vissza a főkategóriákhoz"
                    title="Vissza a főkategóriákhoz"
                    >
                    <svg
                        aria-hidden="true"
                        focusable="false"
                        data-prefix="fas"
                        data-icon="arrow-up"
                        role="img"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 384 512"
                        class="h-4 w-4"
                    >
                        <path
                        fill="currentColor"
                        d="M214.6 41.4c-12.5-12.5-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 141.2 160 448c0 17.7 14.3 32 32 32s32-14.3 32-32l0-306.7L329.4 246.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-160-160z"
                        />
                    </svg>
                    <span>Főkategóriákhoz</span>
                </button>
              {/* Aktív főkategória jelző (+ ugrás az intro doboz tetejére) */}
              {showSubCategory && (
                <button
                type="button"
                onClick={() => {
                  if (tabIntros[active]) {
                    scrollToIntro();
                  } else {
                    // ha nincs intro, a panel tetejére ugrunk
                    scrollToPanelTopIfNeeded(active);
                  }
                }}
                class="px-3 py-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white/80 dark:bg-gray-800/80 backdrop-blur text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
                aria-label={`Ugrás a(z) ${active} tetejére`}
                title={`Ugrás a(z) ${active} tetejére`}
              >
                {active}
              </button>)}
            </div>
          </div>
        </div>
      )}


      {/* Sticky alatti bevezető doboz (ugyanaz a vizuális nyelv, mint a termékkártya) */}

      {activeIntro && (
        <div
          ref={introRef}
          class="flex mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm bg-white dark:bg-gray-800"
          aria-live="polite"
        >
          {activeIntro.image && (
            <img
              src={activeIntro.image}
              alt={activeIntro.imageAlt || active}
              class="w-full w-40 object-cover"
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
      
      <h2 class="text-3xl font-bold text-gray-900 dark:text-white pt-6 pb-4 text-center">
        {activeIntro.title} - Alkategóriái
      </h2>

      {/* Panelek – az aktív főkategória alkategóriái kártyákban */}
      {grouped.map(({ name, items }) => (
        <section
          id={`panel-${toId(name)}`}
          role="tabpanel"
          aria-labelledby={toId(name)}
          data-panel={name}
          ref={(el) => el && panelsRef.current.set(name, el)}
          class={`${name === active ? '' : 'hidden'}`}
        >
          <div class="py-4 grid grid-cols-2 lg:grid-cols-3 gap-6">
            {items.length === 0 ? (
              <div class="col-span-full text-sm text-gray-600 dark:text-gray-400">
                Nincs megjeleníthető kategória ebben a fülben.
              </div>
            ) : (
              items.map((category) => (
                <a
                  key={category.slug}
                  href={`/termekek/${category.slug}`}
                  class="block border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition bg-white dark:bg-gray-800"
                >
                  <div class="w-full h-48 overflow-hidden">
                    {category.meta?.image ? (
                      <img
                        src={category.meta.image}
                        alt={category.category}
                        class="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div class="w-full h-full bg-gray-100 dark:bg-gray-700" aria-hidden="true" />
                    )}
                  </div>
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
