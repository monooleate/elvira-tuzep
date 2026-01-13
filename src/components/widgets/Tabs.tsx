// src/components/MainCategoryGrid.tsx
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import DiscountCardClient from '~/components/widgets/DiscountCardClient';
import { getProductsForMainCategory } from '~/lib/products';
import { isDiscountedProduct, getEffectiveUnitPrice, type Unit } from '~/lib/discounts';


type Product = {
  id?: string | number;
  sku?: string;
  name?: string;
  slug?: string;
  image?: string;
  price?: number;
  inStock?: boolean;
};

type Category = {
  slug: string;
  category: string;
  description?: string;
  /** Lehet string VAGY string[] a product.json-ban */
  maincategory?: string | string[];
  meta?: {
    image?: string;
    description?: string;
    title?: string;
  };
  /** a kategória termékei (product.json-ból) */
  products?: Product[];
  /** Belső, normalizált mező: az összes főkategória, ahová ez a kategória tartozik */
  _maincats?: string[];
};

type TabIntro = {
  title?: string;
  body: string;
  image?: string;
  imageAlt?: string;
};

type Props = {
  categories: Category[];
  headerSelectors?: string[];
  stickyBarId?: string;
  initialTabName?: string;
  tabIntros?: Record<string, TabIntro>;
  productListing?: boolean;
  mainPage?: boolean;
};

const UNIT_PRIORITY: Unit[] = ['pal','db','m','m2','m3'];

export const unitLabel = (u: Unit) =>
  u === 'm2' ? 'm²' : u === 'm3' ? 'm³' : u === 'pal' ? 'raklap' : u;

// Domináns egység meghatározása az aktuális termékhalmazból.
// 1 termékhez az első elérhető egységet vesszük (priority szerint).
export function computeAutoUnit(products: any[]): Unit | null {
  const counts: Record<Unit, number> = { db:0, m:0, m2:0, m3:0, pal:0 };

  for (const p of products) {
    const first = UNIT_PRIORITY.find(u => getEffectiveUnitPrice(p, u) !== null);
    if (first) counts[first] += 1;
  }

  let best: Unit | null = null;
  let bestCount = -1;
  for (const u of UNIT_PRIORITY) {
    if (counts[u] > bestCount) {
      best = u;
      bestCount = counts[u];
    }
  }
  return bestCount > 0 ? best : null;
}


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
  tabIntros = {
        'Műszárított, gyalult építőfa': {
          title: 'Műszárított, gyalult építőfa',
          body:
            'Építkezéshez és zsaluzathoz ideális, érdes felületű, légszáraz vagy friss faanyag. Költséghatékony megoldás ott, ahol a teherbírás fontos, az esztétika kevésbé.',
          image: '/images/products/muszaritott_gyalult_epitofa-500.webp', 
          imageAlt: 'Fűrészelt építőfa'
        },
        'BSH ragasztott gerenda': {
          title: 'BSH ragasztott gerenda',
          body:
            'Kamrában szárított, sima felületű BSH termékek látszó és tartós szerkezetekhez. Stabil, kevesebbet vetemedik és esztétikus eredményt ad tetőkben és belső terekben.',
          image: '/termekek/bsh-gerenda-egyedi.jpg', 
          imageAlt: 'BSH gerenda'
        },
        'Tüzelőanyag': {
          title: 'Tüzelőanyag',
          body:
            'Prémium fabrikett és pellet magas fűtőértékkel, alacsony nedvességtartalommal, minimális hamutartalommaé és tiszta égéssel az otthoni fűtéshez. Válassz gazdaságos, környezetkímélő megoldást gyors átvétellel és kiszállítási opcióval.',
          image: '/kategoriak/brikett.jpg', 
        },
        'Fűrészáru': {
          title: 'Fűrészáru',
          body:
            'Fűrészáru kínálatunkban megtalálja a leggyakrabban használt méreteket és keresztmetszeteket. A fűrészelt faanyag ideális tetőszerkezetek, gerendák, lécek, pallók és egyéb építési munkákhoz. Kedvező árú, természetes építőanyag, amely közvetlenül, raktárról elérhető, széles választékban.',
          image: '/images/products/fureszaru-500.avif',
          imageAlt: 'Fűrészáru kategóriában különböző méretű és vastagságú faanyagok'
        },
        'OSB lapok': {
          title: 'OSB lapok',
          body:
            'OSB lap kínálatunkban megtalálja a legnépszerűbb vastagságokat és méreteket: 6 mm-től 22 mm-ig. Az OSB lap kedvező árú, sokoldalú építőanyag falak, tetők és padlók burkolásához. Népszerű alternatíva az OBI és Praktiker OSB lap választékhoz képest – közvetlenül, raktárról elérhető, széles választékban.',
          image: '/kategoriak/osb3_800x600.jpg',
          imageAlt: 'OSB lapok különböző méretekben és vastagságban'
        },
        'Telített kertifa': {
          title: 'Telített kertifa',
          body:
            'Kertifa kategóriánkban nyomás alatt impregnált, telített faanyagokat találsz kültéri felhasználásra – legyen szó kerítésoszlopról, hegyezett cölöpről, rúdfáról, deszkáról vagy pallóról. Ezek a tartós, időjárás-álló faanyagok ellenállnak a nedvességnek, gombáknak és rovaroknak, így ideálisak kertépítéshez, faültetéshez, játszótéri és szerkezeti elemekhez.',
          image: '/kategoriak/telitett-kertifa.webp',
          imageAlt: 'Kertbe szánt kezelt fa különböző méretekben és típusokban'
        }
      },
  productListing = false,
  mainPage = false,
}: Props) {
  // 🔧 Normalizálás: maincategory -> _maincats: string[]
  const safeData = useMemo<Category[]>(
    () =>
      (Array.isArray(categories) ? categories : []).map((c) => {
        const raw = (c as any)?.maincategory;
        let maincats: string[];
        if (Array.isArray(raw)) {
          maincats = raw.map((s) => String(s || '').trim()).filter(Boolean);
        } else {
          const one = String(raw ?? 'Egyéb').trim();
          maincats = one ? [one] : ['Egyéb'];
        }
        return {
          ...c,
          _maincats: maincats,
          // legacy mezők biztonságos feltöltése (ha valahol még használod):
          maincategory: (Array.isArray(raw) ? maincats[0] : (raw as any)) ?? 'Egyéb',
          products: Array.isArray(c.products) ? c.products : [],
        };
      }),
    [categories]
  );

// --- A safeData MARAD ---

// Dinamikus opciók a legördülőhöz (a tabIntros sorrendje + meglévők a product.json-ban)
const mainTabOrder = useMemo(() => Object.keys(tabIntros ?? {}), [tabIntros]);
const mainTabs = useMemo(() => {
  if (!mainTabOrder.length) return [];
  const exists = new Set<string>();
  safeData.forEach(c => (c._maincats ?? []).forEach(m => exists.add(m)));
  return mainTabOrder.filter(name => exists.has(name));
}, [mainTabOrder, safeData]);

// Kezdő aktív fül biztonságosan
const [active, setActive] = useState<string>(() => {
  const initial =
    initialTabName && mainTabs.includes(initialTabName)
      ? initialTabName
      : (mainTabs[0] ?? '');
  return initial;
});

// Ha változik a mainTabs, tartsuk érvényesnek az aktív fület
useEffect(() => {
  if (!mainTabs.length) return;

  const saved = sessionStorage.getItem("maincat-active");

  if (saved && mainTabs.includes(saved)) {
    setActive(saved);
    return;
  }

  if (!active && mainTabs.length) {
    setActive(mainTabs[0]);
  }
}, [mainTabs]);


  // 🔹 Csoportosítás: főkategória -> azok az alkategóriák, ahol c._maincats tartalmazza a főkategóriát
  const grouped = useMemo(
    () =>
      mainTabs.map((name) => ({
        name,
        items: safeData.filter((c) => (c._maincats ?? []).includes(name)),
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

  // SZŰRŐ ÁLLAPOTOK
const [q, setQ] = useState('');
const [onlyDiscounted, setOnlyDiscounted] = useState(false);
const [onlyStock, setOnlyStock] = useState(false);
const [unit, setUnit] = useState<'db'|'m'|'m2'|'m3'|'pal'>('db');
const [minPrice, setMinPrice] = useState<string>(''); // input mező nyers string
const [maxPrice, setMaxPrice] = useState<string>('');
const [sortBy, setSortBy] = useState<'relevance'|'name'|'price-asc'|'price-desc'>('relevance');
const PAGE = 12;
const [visibleCount, setVisibleCount] = useState(PAGE);
const [maincatFilter, setMaincatFilter] = useState<string>(''); // '' = nincs szűrő

const baseProducts = useMemo(() => {
  if (maincatFilter && mainTabs.includes(maincatFilter)) {
    return getProductsForMainCategory(safeData as any, maincatFilter, {
      onlyDiscounted: false,
      sort: 'stock-name',
    });
  }
  const union = mainTabs.flatMap((name) =>
    getProductsForMainCategory(safeData as any, name, {
      onlyDiscounted: false,
      sort: 'stock-name',
    })
  );
  const seen = new Set<string>();
  return union.filter((p: any) => {
    const key = String(p?.sku ?? p?.slug ?? p?.id ?? Math.random());
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}, [safeData, mainTabs, maincatFilter]);

const autoUnit = useMemo(() => computeAutoUnit(baseProducts), [baseProducts]);




// ha főkategória vált, reseteljük a lapozót és a keresést (opcionális)
useEffect(() => {
  // alapból mindig az aktuális főkategóriára szűrjünk
  setMaincatFilter(active);

  // resetek
  setVisibleCount(PAGE);
  setQ('');
  setOnlyDiscounted(false);
  setOnlyStock(false);
  setMinPrice('');
  setMaxPrice('');
  setSortBy('relevance');
}, [active]);

// SZŰRT + RENDEZETT TERMÉKLISTA a szűrő UI szerint
const filteredProducts = useMemo(() => {
  let list = [...baseProducts];

  // kereső
  const needle = q.trim().toLowerCase();
  if (needle) {
    list = list.filter(p => {
      const name = (p?.name || '').toString().toLowerCase();
      const desc = (p?.description || '').toString().toLowerCase();
      return name.includes(needle) || desc.includes(needle);
    });
  }

  // csak akciós
  if (onlyDiscounted) {
    list = list.filter(isDiscountedProduct);
  }

  // csak raktáron
  if (onlyStock) {
    list = list.filter(p => p?.inStock === true || (typeof p?.stock === 'number' && p.stock > 0));
  }

  // min/max ár egység szerint
  const toInt = (s: string) => {
    const n = Number(String(s).replace(/[^\d]/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  const min = minPrice ? toInt(minPrice) : null;
  const max = maxPrice ? toInt(maxPrice) : null;
  if (min !== null || max !== null) {
    list = list.filter(p => {
      const val = getEffectiveUnitPrice(p, unit);
      if (val === null) return false;
      if (min !== null && val < min) return false;
      if (max !== null && val > max) return false;
      return true;
    });
  }

  // rendezés
  if (sortBy === 'name') {
    list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'hu'));
} else if (sortBy === 'price-asc' || sortBy === 'price-desc') {
  const u = (autoUnit ?? 'db'); // fallback
  list.sort((a, b) => {
    const av = getEffectiveUnitPrice(a, u);
    const bv = getEffectiveUnitPrice(b, u);
    const aMissing = av === null;
    const bMissing = bv === null;
    if (aMissing && bMissing) return (a.name || '').localeCompare(b.name || '', 'hu');
    if (aMissing) return 1;
    if (bMissing) return -1;
    return sortBy === 'price-asc' ? (av! - bv!) : (bv! - av!);
  });
}
 else {
    // relevance: raktáron előre, majd név
    list.sort((a, b) => {
      const ai = (a.inStock ? 0 : 1);
      const bi = (b.inStock ? 0 : 1);
      if (ai !== bi) return ai - bi;
      return (a.name || '').localeCompare(b.name || '', 'hu');
    });
  }

  return list;
}, [baseProducts, q, onlyDiscounted, onlyStock, minPrice, maxPrice, sortBy, autoUnit]);


  // sticky bar beállítás
  useEffect(() => {
    if (stickyBarId) {
      barRef.current = document.getElementById(stickyBarId) as HTMLDivElement | null;
    } else {
      barRef.current = internalBarRef.current;
    }
  }, [stickyBarId]);

  const toId = (s: string) => `tab-${slugify(s)}`;

  const getCombinedOffset = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return 0;
    const headersHeight = headerSelectors.reduce((acc, sel) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      return acc + (el ? el.getBoundingClientRect().height : 0);
    }, 0);
    let stickyTop = 0;
    const bar = barRef.current;
    if (bar) {
      const cs = getComputedStyle(bar);
      stickyTop = parseFloat(cs.top || '0') || 0;
    }
    return Math.max(0, Math.round(headersHeight + stickyTop + 8));
  };

  const prefersReduced = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const smoothScrollTo = (y: number) => {
    if (typeof window === 'undefined') return;
    const behavior = prefersReduced ? 'auto' : 'smooth';
    try { window.scrollTo({ top: y, behavior: behavior as ScrollBehavior }); }
    catch { window.scrollTo(0, y); }
  };

  const scrollToIntro = () => {
    const el = introRef.current;
    if (!el) return;
    const offset = getCombinedOffset();
    const rect = el.getBoundingClientRect();
    const absoluteTop = window.scrollY + rect.top - offset + 30;
    smoothScrollTo(absoluteTop);
  };

  function waitForScrollSettle(cb: () => void, timeout = 800) {
    if (typeof window === 'undefined') return cb();
    let lastY = window.scrollY;
    let remaining = timeout;
    function tick() {
      const y = window.scrollY;
      if (Math.abs(y - lastY) < 1) {
        cb();
        return;
      }
      lastY = y;
      remaining -= 16;
      if (remaining <= 0) return cb();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

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
      waitForScrollSettle(() => { isScrollingRef.current = false; });
    });
  };

  const scrollToGridBottom = () => {
    const el = gridBottomRef.current;
    if (!el) return;
    const offset = getCombinedOffset();
    const rect = el.getBoundingClientRect();
    const absoluteTop = window.scrollY + rect.top - offset;
    smoothScrollTo(absoluteTop);
  };

  const scrollToGridTop = () => {
    const el = gridTopRef.current;
    if (!el) return;
    const offset = getCombinedOffset();
    const rect = el.getBoundingClientRect();
    const absoluteTop = window.scrollY + rect.top - offset;
    smoothScrollTo(absoluteTop);
  };

  const scrollToActiveStart = (name: string) => {
    requestAnimationFrame(() => {
      scrollToGridBottom();
      if (tabIntros[name]) {
        requestAnimationFrame(() => scrollToIntro());
      } else {
        scrollToPanelTopIfNeeded(name);
      }
    });
  };

  // Sticky láthatóság
  useEffect(() => {
    const onScroll = () => {
      const bottom = gridBottomRef.current;
      if (!bottom) return;
      const bottomTop = bottom.getBoundingClientRect().top;
      const visible = bottomTop <= (headerSelectors.length ? 120 : 60);
      setShowSubCategory(visible);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [headerSelectors]);

  const activeIntro: TabIntro | undefined = tabIntros[active];

  useEffect(() => {
  const savedScroll = sessionStorage.getItem("maincat-scroll");
  if (savedScroll) {
    sessionStorage.removeItem("maincat-scroll");
    setTimeout(() => {
      window.scrollTo(0, Number(savedScroll));
    }, 20);
  }
}, []);

  return (
    <div ref={rootRef} class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      


      {mainPage ? 
        (
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white pt-6 pb-4 text-center">
            Termékkatalógus
          </h2>
        ) :
        (      
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white pt-6 pb-4 text-center">
            Termékkatalógus
          </h1>
        )
      }

      {/* Főkategória csempék */}
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

              // Alkategóriák az adott főkategóriához
              const subcats = grouped.find((g) => g.name === name)?.items ?? [];

              // CSAK ez kell:
                // - ha 1 alkategória → LINK az egy szem alkategóriára
                // - ha több → TAB
                const shouldLink = subcats.length === 1;
                const linkTarget = shouldLink
                ? `/termekek/${subcats[0]?.slug ?? ''}`
                : '#';

              return (
                

                <div key={name} class="group">
                  {shouldLink ? (
                    <a
                      href={linkTarget}
                      class={`block w-full text-left rounded-xl overflow-hidden border transition shadow-sm 
                        ${isActive ? 'border-orange-500 ring-1 ring-orange-500' : 'border-gray-200 dark:border-gray-700 hover:shadow-md'}
                        bg-white dark:bg-gray-800`}
                    >
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

                      {mainPage ? (
                        <h3 class="p-3">
                          <span
                            class={`block text-sm font-semibold ${
                              isActive
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {name}
                          </span>
                        </h3>
                      )
                      :
                      (
                        <h2 class="p-3">
                          <span
                            class={`block text-sm font-semibold ${
                              isActive
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {name}
                          </span>
                        </h2>
                      )}
                    
                    </a>
                  ) : (
                    <button
                      id={id}
                      type="button"
                      role="tab"
                      aria-selected={isActive ? 'true' : 'false'}
                      aria-controls={`panel-${toId(name)}`}
                      data-tab={name}
                      onClick={() => {
                        sessionStorage.setItem("maincat-active", name);
                        sessionStorage.setItem("maincat-scroll", String(window.scrollY));
                        setActive(name);

                        setTimeout(() => {
                          scrollToActiveStart(name);
                        }, 35);
                      }}
                      class={`w-full text-left rounded-xl overflow-hidden border transition shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-500
                        ${isActive ? 'border-orange-500 ring-1 ring-orange-500' : 'border-gray-200 dark:border-gray-700 hover:shadow-md'}
                        bg-white dark:bg-gray-800`}
                    >
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


                      {mainPage ? (
                        <h3 class="p-3">
                          <span
                            class={`block text-sm font-semibold ${
                              isActive
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {name}
                          </span>
                        </h3>
                      )
                      :
                      (
                        <h2 class="p-3">
                          <span
                            class={`block text-sm font-semibold ${
                              isActive
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {name}
                          </span>
                        </h2>
                      )}


                    </button>
                  )}
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
        <div class="sticky top-[calc(env(safe-area-inset-top)+72px)] md:top-[calc(env(safe-area-inset-top)+86px)] z-40 dark:bg-gray-900/80 backdrop-blur">
          <div class="mx-auto max-w-6xl">
            <div class="flex flex-wrap items-center justify-center gap-2 py-2">
              <button
                type="button"
                onClick={scrollToGridTop}
                class="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-orange-500 text-white text-sm font-medium shadow hover:bg-orange-600 active:scale-[.99]"
                aria-label="Vissza a főkategóriákhoz"
                title="Vissza a főkategóriákhoz"
              >
                {/* up icon */}
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

              {showSubCategory && (
                <button
                  type="button"
                  onClick={() => {
                    if (tabIntros[active]) {
                      scrollToIntro();
                    } else {
                      scrollToPanelTopIfNeeded(active);
                    }
                  }}
                  class="px-3 py-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white/80 dark:bg-gray-800/80 backdrop-blur text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
                  aria-label={`Ugrás a(z) ${active} tetejére`}
                  title={`Ugrás a(z) ${active} tetejére`}
                >
                  {active}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sticky alatti bevezető doboz */}
      {activeIntro && (
        <div
          ref={introRef}
          class="flex mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm bg-white dark:bg-gray-800"
          aria-live="polite"
        >
          {/* activeIntro.image */ false && (
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
              <p class="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {activeIntro.title}
              </p>
            )}
            <p class="text-sm text-gray-700 dark:text-gray-300">{activeIntro.body}</p>
          </div>
        </div>
      )}

      <p class="text-3xl font-bold text-gray-900 dark:text-white pt-6 pb-4 text-center">
        {(activeIntro?.title || active)} – Alkategóriái
      </p>

      {/* Panelek – az aktív főkategória alkategóriái */}
      {grouped.map(({ name, items }) => (
        <section
          id={`panel-${toId(name)}`}
          role="tabpanel"
          aria-labelledby={toId(name)}
          data-panel={name}
          ref={(el) => el && panelsRef.current.set(name, el)}
          class={`${name === active ? '' : 'hidden'}`}
        >
          <div class="py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.length === 0 ? (
              <div class="col-span-full text-sm text-gray-600 dark:text-gray-400">
                Nincs megjeleníthető kategória ebben a fülben.
              </div>
            ) : (
              items.map((category) => (
                <a
                  key={category.slug}
                  href={`/termekek/${category.slug}`}
                    onClick={() => {
    sessionStorage.setItem("maincat-scroll", String(window.scrollY));
  }}
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

                    {mainPage ? 
                      (
                        <h4 class="text-lg font-semibold text-gray-900 dark:text-white">
                          {category.category}
                        </h4>
                      ) 
                      :
                      (
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                          {category.category}
                        </h3>
                      )
                    }
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {category.meta?.description || category.description || ''}
                    </p>
                  </div>
                </a>
              ))
            )}
          </div>

          {/* Összes termék az aktív főkategóriában */}
          {productListing && name === active && baseProducts.length > 0 && (
            <div class="mt-6">
              <div class="flex items-end justify-center gap-4 mb-3">
                <p class="text-3xl font-bold text-gray-900 dark:text-white pt-6 pb-4 text-center">
                Összes termék {maincatFilter ? `– ${maincatFilter}` : '– minden főkategória'}{' '}
                <span class="text-gray-500 dark:text-gray-400 font-normal">
                    ({filteredProducts.length})
                </span>
                </p>
              </div>

             {/* fő vezérlők rácsa – ÚJ elrendezés */}
            <div class="px-4 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* BAL OSZLOP: Kereső + alatta Rendezés */}
              <div class="space-y-3">
                {/* Kereső */}
                <label class="block group">
                  <span class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Keresés</span>
                  <div class="relative">
                    <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none">
                      <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
                      <path d="M20 20l-3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <input
                      type="text"
                      value={q}
                      onInput={(e: any) => setQ(e.currentTarget.value)}
                      placeholder="Terméknév, leírás…"
                      class="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    />
                  </div>
                </label>

                {/* Rendezés (Keresés alatt) */}
                <label class="block">
                  <span class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Rendezés</span>
                  <div class="relative">
                    <select
                      value={sortBy}
                      onChange={(e: any) => setSortBy(e.currentTarget.value)}
                      class="w-full appearance-none pl-3 pr-9 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    >
                      <option value="relevance">Relevancia</option>
                      <option value="name">Név (A–Z)</option>
                      <option value="price-asc">Ár szerint (növ.)</option>
                      <option value="price-desc">Ár szerint (csökk.)</option>
                    </select>
                    <svg class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.117l3.71-3.886a.75.75 0 111.08 1.04l-4.24 4.444a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z"/>
                    </svg>
                  </div>
                </label>
              </div>

              {/* JOBB OSZLOP: Főkategória + mellé (lg) az Akciós/Raktáron pickerek */}
              <div class="space-y-3">
                {/* Főkategória legördülő */}
                <label class="block group">
                  <span class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Főkategória</span>
                  <div class="relative">
                    <select
                      value={maincatFilter}
                      onChange={(e: any) => { setMaincatFilter(e.currentTarget.value); setVisibleCount(PAGE); }}
                      class="w-full appearance-none pl-3 pr-9 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    >
                      <option value="">(összes)</option>
                      {mainTabs.map((mc) => (
                        <option key={mc} value={mc}>{mc}</option>
                      ))}
                    </select>
                    <svg class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.117l3.71-3.886a.75.75 0 111.08 1.04l-4.24 4.444a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z"/>
                    </svg>
                  </div>
                </label>

                {/* Akciós / Raktáron – nagy képernyőn mellé, mobilon alá (rugalmas sor) */}
                <span class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Választás</span>
                <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <label class="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                    <input
                      type="checkbox"
                      checked={onlyDiscounted}
                      onChange={(e: any) => setOnlyDiscounted(e.currentTarget.checked)}
                      class="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500/60"
                    />
                    Csak akciós
                  </label>

                  <label class="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-transparent hover:border-gray-300 dark:hover:border-gray-600">
                    <input
                      type="checkbox"
                      checked={onlyStock}
                      onChange={(e: any) => setOnlyStock(e.currentTarget.checked)}
                      class="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500/60"
                    />
                    Csak raktáron
                  </label>
                </div>
              </div>
            </div>
              {baseProducts.length === 0 ? (
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  Nincs megjeleníthető termék ebben a főkategóriában.
                </p>
              ) : (
                <>
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProducts.slice(0, visibleCount).map((p, i) => (
                      <DiscountCardClient key={(p.id as any) ?? p.sku ?? p.slug ?? i} product={p} />
                    ))}
                  </div>

                  {visibleCount < filteredProducts.length && (
                    <div class="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((v) => v + PAGE)}
                        class="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
                      >
                        Továbbiak betöltése
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
