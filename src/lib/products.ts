// src/utils/products.ts
export type Product = {
  id?: string | number;
  sku?: string;
  name?: string;
  slug?: string;
  image?: string;
  price?: number;
  mprice?: number;
  m2price?: number;
  m3price?: number;
  palprice?: number;
  inStock?: boolean;
  discountPrice?: number;
  discountPercent?: number;
  discountValidUntil?: string;
  // a kártya kedvezményhez:
  finalDiscountPrice?: number | null;
  finalDiscountPercent?: number | null;
  // kitöltjük később:
  categorySlug?: string;
};

export type CategoryWithProducts = {
  slug: string;
  category: string;
  /** Lehet string VAGY string[] a product.json-ban */
  maincategory: string | string[];
  products?: Product[];
  /** (opcionális, ha máshol már normalizálsz) */
  _maincats?: string[];
};

const toDate = (v: unknown) => {
  if (!v) return null;
  const d = new Date(v as any);
  return isNaN(+d) ? null : d;
};

function computeDiscountFields(p: Product, now = new Date()) {
  const until = toDate(p.discountValidUntil);
  const within = !until || until > now;

  const hasDP =
    typeof p.discountPrice === 'number' &&
    p.discountPrice! > 0 &&
    typeof p.price === 'number' &&
    p.discountPrice! < p.price!;
  const hasPct =
    typeof p.discountPercent === 'number' &&
    p.discountPercent! > 0 &&
    p.discountPercent! < 100;

  if (!within || (!hasDP && !hasPct) || typeof p.price !== 'number') {
    return { finalDiscountPrice: null, finalDiscountPercent: null };
  }

  const finalDiscountPrice = hasDP
    ? Math.round(p.discountPrice!)
    : hasPct
    ? Math.round(p.price! * (1 - p.discountPercent! / 100))
    : null;

  const finalDiscountPercent = hasPct
    ? Math.round(p.discountPercent!)
    : hasDP && finalDiscountPrice
    ? Math.round((1 - finalDiscountPrice / p.price!) * 100)
    : null;

  return { finalDiscountPrice, finalDiscountPercent };
}

function dedupeBy<T, K extends string | number | undefined>(arr: T[], keyFn: (x: T) => K): T[] {
  const out: T[] = [];
  const seen = new Set<K>();
  for (const it of arr) {
    const k = keyFn(it);
    if (k === undefined || !seen.has(k)) {
      if (k !== undefined) seen.add(k);
      out.push(it);
    }
  }
  return out;
}

/** Normalizálja a főkategória tagságot string[]-re (_maincats) */
function getMaincats(c: CategoryWithProducts): string[] {
  if (Array.isArray(c._maincats) && c._maincats.length) return c._maincats;
  const raw = c.maincategory as any;
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s || '').trim()).filter(Boolean);
  }
  const one = String(raw ?? 'Egyéb').trim();
  return one ? [one] : ['Egyéb'];
}

export function getProductsForMainCategory(
  categories: CategoryWithProducts[],
  mainName: string,
  opts?: { onlyDiscounted?: boolean; sort?: 'stock-name' | 'name' }
) {
  const onlyDiscounted = opts?.onlyDiscounted ?? false;
  const sort = opts?.sort ?? 'stock-name';

  // 1) az adott főkategória alkategóriái (_maincats/includes)
  const subcats = (Array.isArray(categories) ? categories : []).filter((c) =>
    getMaincats(c).includes(mainName)
  );

  // 2) flatten + categorySlug hozzárendelése + kedvezmény mezők számítása
  const flattened = subcats.flatMap((cat) =>
    (cat.products ?? []).map((p) => {
      const { finalDiscountPrice, finalDiscountPercent } = computeDiscountFields(p);
      return {
        ...p,
        finalDiscountPrice,
        finalDiscountPercent,
        categorySlug: cat.slug,
      } as Product;
    })
  );

  // 3) csak akciósak, ha kérted
  const filtered = onlyDiscounted
    ? flattened.filter(
        (p) =>
          typeof p.finalDiscountPrice === 'number' &&
          typeof p.finalDiscountPercent === 'number'
      )
    : flattened;

  // 4) duplikátum szűrés (sku -> id -> slug sorrend)
  const bySku = dedupeBy(filtered, (p) => (p.sku as any) || undefined);
  const byId = dedupeBy(bySku, (p) => (p.id as any) || undefined);
  const deduped = dedupeBy(byId, (p) => (p.slug as any) || undefined);

  // 5) rendezés
  if (sort === 'stock-name') {
    deduped.sort((a, b) => {
      const ai = a.inStock ? 0 : 1;
      const bi = b.inStock ? 0 : 1;
      if (ai !== bi) return ai - bi;
      const an = (a.name || '').toString();
      const bn = (b.name || '').toString();
      return an.localeCompare(bn, 'hu');
    });
  } else {
    deduped.sort((a, b) =>
      (a.name || '').toString().localeCompare((b.name || '').toString(), 'hu')
    );
  }

  return deduped;
}
