// lib/discount.ts (vagy a meglévő fájlod, ahol a computeDiscounted van)

export type Unit = 'db'|'m'|'m2'|'m3'|'pal';

// ~/lib/discounts

export function parseDiscountUntil(raw?: string | null): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // 1) YYYY.MM.DD  vagy  "YYYY. MM. DD."  → helyi nap vége
  {
    const m = s.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/);
    if (m) {
      const [, Y, M, D] = m;
      const d = new Date(+Y, +M - 1, +D, 23, 59, 59, 999);
      return isNaN(+d) ? null : d;
    }
  }

  // 2) YYYY.MM.DD HH:mm[:ss]  → helyi idő
  {
    const m = s.match(
      /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
    );
    if (m) {
      const [, Y, M, D, hh, mm, ss] = m;
      const d = new Date(+Y, +M - 1, +D, +hh, +mm, ss ? +ss : 0, 0);
      return isNaN(+d) ? null : d;
    }
  }

  // 3) ISO nap: YYYY-MM-DD → helyi nap vége
  {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const [, Y, M, D] = m;
      const d = new Date(+Y, +M - 1, +D, 23, 59, 59, 999);
      return isNaN(+d) ? null : d;
    }
  }

  // 4) ISO dátum/idő (szóköz helyett 'T' normalizálás)
  const norm = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(norm);
  return isNaN(+d) ? null : d;
}


// --- Szigorú akciófeltétel: csak ha VAN lejárat és az a jövőben van
export function isDiscountActive(p: any, now = new Date()): boolean {
  const until = parseDiscountUntil(p?.discountValidUntil);
  return !!until && until.getTime() > now.getTime();
}

export function hasValidPercent(p: any): boolean {
  return typeof p?.discountPercent === 'number' && p.discountPercent > 0 && p.discountPercent < 100;
}

export function hasValidFixPrice(p: any): boolean {
  return typeof p?.discountPrice === 'number' &&
         p.discountPrice > 0 &&
         typeof p?.price === 'number' &&
         p.discountPrice < p.price;
}

// --- Lista-szűréshez: akciós termék-e?
export function isDiscountedProduct(p: any): boolean {
  if (!isDiscountActive(p)) return false;
  return hasValidPercent(p) || hasValidFixPrice(p);
}

// --- Kártyához: darabár akció kiszámítása (fix és % közül a kedvezőbb)
export function computeDiscountForCard(p: any) {
  if (!isDiscountActive(p)) {
    return { hasDiscount: false, discountPrice: null, discountPercent: null };
  }

  const base =
    typeof p?.price === "number" ? p.price
    : typeof p?.priceFrom === "number" ? p.priceFrom
    : null;

  if (base === null) {
    return { hasDiscount: false, discountPrice: null, discountPercent: null };
  }

  const pctOk = hasValidPercent(p);
  const fixOk = hasValidFixPrice(p);

  if (!pctOk && !fixOk) {
    return { hasDiscount: false, discountPrice: null, discountPercent: null };
  }

  // ⬇️ ITT A LÉNYEG
  const fromPercent = pctOk
    ? round1(base * (1 - p.discountPercent / 100))
    : null;

  const fromFix = fixOk
    ? round1(p.discountPrice)
    : null;

  const discountPrice =
    fromPercent !== null && fromFix !== null
      ? Math.min(fromPercent, fromFix)
      : fromPercent ?? fromFix ?? null;

  // százalék maradhat egész
  const discountPercent =
    discountPrice !== null
      ? Math.round((1 - discountPrice / base) * 100)
      : null;

  return {
    hasDiscount: discountPrice !== null,
    discountPrice,
    discountPercent,
  };
}


function round1(val: number): number {
  return Math.round(val * 10) / 10;
} 
// --- Szűrés/rendezéshez: egységár akció figyelembevételével
export function getEffectiveUnitPrice(p: any, unit: Unit): number | null {
  const pick = (val?: unknown) => {
    const num = typeof val === 'number'
      ? val
      : typeof val === 'string'
        ? Number(String(val).replace(/\s/g, ''))
        : NaN;
    return Number.isFinite(num) && num > 0 ? num : null;
  };

  const base =
    unit === 'db'  ? pick(p.price)   :
    unit === 'm'   ? pick(p.mprice)  :
    unit === 'm2'  ? pick(p.m2price) :
    unit === 'm3'  ? pick(p.m3price) :
    unit === 'pal' ? pick(p.palprice): null;

  if (base === null) return null;
  if (!isDiscountActive(p)) return base;

  const pctOk = hasValidPercent(p);
  const fixOk = hasValidFixPrice(p);

  let val = base;
  if (pctOk) val = Math.round(val * (1 - p.discountPercent / 100));
  if (unit === 'db' && fixOk) val = Math.min(val, Math.round(p.discountPrice));
  return val;
}

// --- A meglévő aggregátorod: frissítve a parserrel + szigorral
export function computeDiscounted(input: any[]) {
  const now = new Date();

  // 1) Ha Category[] jellegű (van category.products)
  const looksLikeCategories =
    Array.isArray(input) &&
    input.length > 0 &&
    typeof input[0] === "object" &&
    input[0] &&
    Array.isArray((input[0] as any).products);

  if (looksLikeCategories) {
    return input.flatMap((category) =>
      (category.products ?? [])
        .map((product: any) => {
          // meglévő logikád változatlan
          const { price, discountPrice, discountPercent } = product;

          const active = isDiscountActive(product, now);
          const pctOk  = active && hasValidPercent(product);
          const fixOk  = active && hasValidFixPrice(product);

          if (!pctOk && !fixOk) return null;

          const base = typeof price === "number" ? price : null;
          if (base === null) return null;

          const fromPercent = pctOk ? Math.round(base * (1 - discountPercent / 100)) : null;
          const fromFix     = fixOk ? Math.round(discountPrice) : null;

          const finalDiscountPrice =
            fromPercent !== null && fromFix !== null ? Math.min(fromPercent, fromFix)
            : fromPercent ?? fromFix ?? null;

          const finalDiscountPercent =
            finalDiscountPrice !== null ? Math.round((1 - finalDiscountPrice / base) * 100) : null;

          return {
            ...product,
            finalDiscountPrice,
            finalDiscountPercent,
            categorySlug: category.slug,
          };
        })
        .filter(Boolean)
    );
  }

  // 2) IndexItem[] jellegű (van priceFrom + categorySlug)
  // Itt nincs category.products, hanem maga az input a termék lista
  return (input ?? [])
    .map((p: any) => {
      // index mezők: priceFrom, discountPercent, discountValidUntil
      // fix kedvezmény (discountPrice) indexben általában nincs → csak % akciót tudunk biztosan
      const price = typeof p?.priceFrom === "number" ? p.priceFrom : (typeof p?.price === "number" ? p.price : null);

      const active = isDiscountActive(p, now);
      const pctOk = active && hasValidPercent(p);

      // fix áras akció indexből nem mindig számolható (nincs discountPrice)
      // ha nálad az indexbe is bekerül a discountPrice, akkor ezt is engedjük:
      const fixOk = active && typeof p?.discountPrice === "number" && price !== null && p.discountPrice < price;

      if (!pctOk && !fixOk) return null;
      if (price === null) return null;

      const fromPercent = pctOk ? Math.round(price * (1 - p.discountPercent / 100)) : null;
      const fromFix     = fixOk ? Math.round(p.discountPrice) : null;

      const finalDiscountPrice =
        fromPercent !== null && fromFix !== null ? Math.min(fromPercent, fromFix)
        : fromPercent ?? fromFix ?? null;

      const finalDiscountPercent =
        finalDiscountPrice !== null ? Math.round((1 - finalDiscountPrice / price) * 100) : null;

      return {
        ...p,
        // egységes “price” mezőt adunk, ha a consumer ezt várja
        price,
        finalDiscountPrice,
        finalDiscountPercent,
        categorySlug: p.categorySlug ?? p.category ?? null,
      };
    })
    .filter(Boolean);
}

// src/lib/discounts.ts (vagy ahol a fetchDiscountedProducts van)
import { localGetGlobalIndex, type ListItem } from './local-catalog';

/**
 * Akciós termékek lekérése LOCAL módban
 * - Az index JSON már tartalmazza a hasDiscount flag-et
 * - Egyszerű szűrés: hasDiscount === true
 */
export function fetchDiscountedProducts(limit = 20): ListItem[] {

  
  // Global index betöltése
  const allProducts = localGetGlobalIndex();

  
  // Szűrés: hasDiscount === true
  const discounted = allProducts.filter((p) => p.hasDiscount === true);

  

  
  // Limit alkalmazása
  return discounted.slice(0, limit);
}

// ~/lib/discounts.ts

export type DiscountBadge = {
  hasDiscount: boolean;
  discountPercent: number | null;
  discountPrice: number | null;        // ha fix ár is van
  discountValidUntil: string | null;
};

// Precomputed-first: ha build már kiszámolta a hasDiscount-ot, azt tekintjük igaznak.
// %-ot csak akkor adunk vissza, ha van és érvényes.
export function getDiscountBadge(p: any, now = new Date()) {
  // 1) ha vannak variánsok: max kedvezmény + aktív ellenőrzés variánsonként
  if (Array.isArray(p?.variants) && p.variants.length > 0) {
    let has = false;
    let maxPct: number | null = null;
    let anyUntil: string | null = null;

    for (const v of p.variants) {
      const until = parseDiscountUntil(v?.discountValidUntil ?? null);
      const active = !!until && until.getTime() > now.getTime();
      if (!active) continue;

      const pct = hasValidPercent(v) ? v.discountPercent : null;
      const fixOk = typeof v?.discountPrice === "number" && v.discountPrice > 0;

      if (pct !== null || fixOk) {
        has = true;
        if (pct !== null) maxPct = maxPct === null ? pct : Math.max(maxPct, pct);
        anyUntil = v.discountValidUntil ?? anyUntil;
      }
    }

    return {
      hasDiscount: has,
      discountPercent: has ? maxPct : null,
      discountPrice: null,               // badge-hez nem kell fix ár itt
      discountValidUntil: has ? anyUntil : null,
    };
  }

  // 2) nincs variáns: precomputed-first
  const untilRaw = p?.discountValidUntil ?? null;
  const until = parseDiscountUntil(untilRaw);
  const active = !!until && until.getTime() > now.getTime();

  const preHas = p?.hasDiscount === true;
  const pct = hasValidPercent(p) ? p.discountPercent : null;
  const fixOk = typeof p?.discountPrice === "number" && p.discountPrice > 0;

  const hasDiscount = active && (preHas || pct !== null || fixOk);

  return {
    hasDiscount,
    discountPercent: hasDiscount ? pct : null,
    discountPrice: hasDiscount && fixOk ? Math.round(p.discountPrice) : null,
    discountValidUntil: hasDiscount ? String(untilRaw ?? "") || null : null,
  };
}

export type PriceInfo = {
  kind: Unit;
  unitLabel: "Ft/db" | "Ft/m" | "Ft/m²" | "Ft/m³" | "Ft/raklap";
  base: number;
  final: number;
  hasDiscount: boolean;
  discountValidUntil: string | null;
  discountPercent: number | null;
};

const unitLabelMap: Record<Unit, PriceInfo["unitLabel"]> = {
  db: "Ft/db",
  m: "Ft/m",
  m2: "Ft/m²",
  m3: "Ft/m³",
  pal: "Ft/raklap",
};

function pickNumber(val: unknown): number | null {
  const num =
    typeof val === "number"
      ? val
      : typeof val === "string"
        ? Number(String(val).replace(/\s/g, ""))
        : NaN;
  return Number.isFinite(num) && num > 0 ? num : null;
}

// Egységhez tartozó base ár kiválasztása
function getBaseByUnit(p: any, unit: Unit): number | null {
  return unit === "db" ? pickNumber(p?.price)
    : unit === "m" ? pickNumber(p?.mprice)
    : unit === "m2" ? pickNumber(p?.m2price)
    : unit === "m3" ? pickNumber(p?.m3price)
    : unit === "pal" ? pickNumber(p?.palprice)
    : null;
}

// Egységhez tartozó fix akciós ár (ha van) – nálad jelenleg a db fix biztos,
// de ha a variánsban van discountMPrice/discountM2Price/... akkor itt kezeljük.
function getFixDiscountByUnit(p: any, unit: Unit): number | null {
  const v =
    unit === "db" ? p?.discountPrice
    : unit === "m" ? p?.discountMPrice
    : unit === "m2" ? p?.discountM2Price
    : unit === "m3" ? p?.discountM3Price
    : unit === "pal" ? p?.discountPalPrice
    : null;
  return pickNumber(v);
}

/**
 * Egy variánsra visszaadja az első elérhető egységárat (db → m → m2 → m3 → pal),
 * és kiszámolja a végső árat (% és/vagy fix ár), csak ha az akció aktív.
 */
export function computeFinalPriceInfo(p: any, now = new Date()): PriceInfo | null {
  const order: Unit[] = ["db", "m", "m2", "m3", "pal"];

  for (const unit of order) {
    const base = getBaseByUnit(p, unit);
    if (base === null) continue;

    // alapérték: nincs akció
    let final = base;
    let hasDiscount = false;

    // akció csak aktív lejárattal
    const active = isDiscountActive(p, now);

    if (active) {
      // 1) százalék (minden egységre értelmezhető)
      if (hasValidPercent(p)) {
        final = Math.round(final * (1 - p.discountPercent / 100));
        hasDiscount = true;
      }

      // 2) fix ár (egység-specifikus)
      const fix = getFixDiscountByUnit(p, unit);
      if (fix !== null && fix < base) {
        final = Math.min(final, Math.round(fix));
        hasDiscount = true;
      }
    }

    return {
      kind: unit,
      unitLabel: unitLabelMap[unit],
      base,
      final,
      hasDiscount,
      discountValidUntil: p?.discountValidUntil ?? null,
      discountPercent: hasDiscount && hasValidPercent(p) ? p.discountPercent : null,
    };
  }

  return null;
}




