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
  const base = typeof p?.price === 'number' ? p.price : null;
  if (base === null) {
    return { hasDiscount: false, discountPrice: null, discountPercent: null };
  }

  const pctOk = hasValidPercent(p);
  const fixOk = hasValidFixPrice(p);

  if (!pctOk && !fixOk) {
    return { hasDiscount: false, discountPrice: null, discountPercent: null };
  }

  const fromPercent = pctOk ? Math.round(base * (1 - p.discountPercent / 100)) : null;
  const fromFix     = fixOk ? Math.round(p.discountPrice) : null;

  const discountPrice =
    fromPercent !== null && fromFix !== null ? Math.min(fromPercent, fromFix)
    : fromPercent ?? fromFix ?? null;

  const discountPercent =
    discountPrice !== null ? Math.round((1 - discountPrice / base) * 100) : null;

  return { hasDiscount: discountPrice !== null, discountPrice, discountPercent };
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
export function computeDiscounted(productsData: any[]) {
  const now = new Date();
  return productsData.flatMap((category) =>
    category.products
      .map((product: any) => {
        const { price, discountPrice, discountPercent } = product;

        const active = isDiscountActive(product, now);
        const pctOk  = active && hasValidPercent(product);
        const fixOk  = active && hasValidFixPrice(product);

        if (!pctOk && !fixOk) return null;

        const base = typeof price === 'number' ? price : null;
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
