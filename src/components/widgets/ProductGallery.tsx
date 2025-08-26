// src/components/ProductGallery.tsx
import { useEffect, useRef, useState } from 'preact/hooks';
import EmblaCarousel from 'embla-carousel';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';

type RawImage = { src: string; alt?: string } | string;
type ImageItem = { base: string; alt: string };
type Props = { product: any };

const CANDIDATE_WIDTHS = [1200, 500] as const; // nagy -> kicsi
const FALLBACK_WIDTH_DEFAULT = 500;
const DEFAULT_SIZES = '(max-width: 640px) 90vw, (max-width: 1200px) 70vw, 1200px';
const THUMB_WIDTH = 500; // külön thumbs fájl nélkül ezt használjuk
const LIGHTBOX_DEFAULT_W = 1200; // fallback, amíg nem detektálunk
const LIGHTBOX_DEFAULT_H = 800;

// ——— GLOBAL CACHES a duplikált hálózati kérések elkerülésére
const _existsCache = new Map<string, Promise<boolean>>();
const _sizeCache = new Map<string, Promise<{ w: number; h: number }>>();
const _availableCache = new Map<string, Promise<{ avif: number[]; webp: number[]; jpg: number[] }>>();
const _lightboxPickCache = new Map<string, Promise<{ url: string; w: number; h: number }>>();

// ——— segédek
const toBase = (src: string) => src.replace(/\.(jpe?g|png|webp|avif)$/i, '');

function normalizeImages(product: any): ImageItem[] {
  if (Array.isArray(product?.images) && product.images.length > 0) {
    return product.images.map((it: RawImage) => {
      const src = typeof it === 'string' ? it : it.src;
      const alt = typeof it === 'string' ? (product?.name ?? 'Termékkép') : (it.alt ?? product?.name ?? 'Termékkép');
      return { base: toBase(src), alt };
    });
  }
  if (Array.isArray(product?.image) && product.image.length > 0) {
    return product.image.map((it: RawImage) => {
      const src = typeof it === 'string' ? it : it.src;
      const alt = typeof it === 'string' ? (product?.name ?? 'Termékkép') : (it.alt ?? product?.name ?? 'Termékkép');
      return { base: toBase(src), alt };
    });
  }
  if (typeof product?.image === 'string') {
    return [{ base: toBase(product.image), alt: product?.name ?? 'Termékkép' }];
  }
  return [];
}

// ——— böngésző oldali elérhetőség-ellenőrzés (cache-elve)
const checkImage = (url: string) => {
  if (_existsCache.has(url)) return _existsCache.get(url)!;
  const p = new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = url;
  });
  _existsCache.set(url, p);
  return p;
};

// természetes (valódi) méretek kiolvasása (cache-elve)
const getNaturalSize = (url: string) => {
  if (_sizeCache.has(url)) return _sizeCache.get(url)!;
  const p = new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = () => resolve({ w: LIGHTBOX_DEFAULT_W, h: LIGHTBOX_DEFAULT_H });
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = url;
  });
  _sizeCache.set(url, p);
  return p;
};

// mely variánsok léteznek ehhez a base-hez? (cache-elve)
async function detectAvailable(base: string, widths = CANDIDATE_WIDTHS) {
  const cacheKey = `${base}|${widths.join(',')}`;
  if (_availableCache.has(cacheKey)) return _availableCache.get(cacheKey)!;

  const p = (async () => {
    const out = { avif: [] as number[], webp: [] as number[], jpg: [] as number[] };
    for (const w of widths) {
      const [hasAvif, hasWebp, hasJpg] = await Promise.all([
        checkImage(`${base}-${w}.avif`),
        checkImage(`${base}-${w}.webp`),
        checkImage(`${base}-${w}.jpg`),
      ]);
      if (hasAvif) out.avif.push(w);
      if (hasWebp) out.webp.push(w);
      if (hasJpg) out.jpg.push(w);
    }
    // nagy -> kicsi sorrend
    (['avif', 'webp', 'jpg'] as const).forEach((k) => out[k].sort((a, b) => b - a));
    return out;
  })();

  _availableCache.set(cacheKey, p);
  return p;
}

function buildSrcset(base: string, ext: 'avif' | 'webp' | 'jpg', widths: number[]) {
  return widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(', ');
}

// a lightboxhoz kiválasztjuk a legnagyobb ELÉRHETŐ fájlt és lekérdezzük a valós méretét (cache-elve)
async function pickLightboxTarget(base: string) {
  if (_lightboxPickCache.has(base)) return _lightboxPickCache.get(base)!;

  const p = (async () => {
    const avail = await detectAvailable(base);
    // preferencia: jpg > webp > avif (kompatibilitás)
    const pick = (ext: 'jpg' | 'webp' | 'avif') => {
      const list = (avail as any)[ext] as number[];
      return list.length ? { ext, width: list[0] } : null;
    };
    const choice = pick('jpg') || pick('webp') || pick('avif');
    const url = choice ? `${base}-${choice.width}.${choice.ext}` : `${base}-${FALLBACK_WIDTH_DEFAULT}.jpg`;
    const nat = await getNaturalSize(url);
    return { url, w: nat.w, h: nat.h };
  })();

  _lightboxPickCache.set(base, p);
  return p;
}

// dinamikus <picture> ami maga deríti fel a létező variánsokat (duplikátumok minimalizálva)
function PictureDynamic({
  base,
  alt,
  sizes = DEFAULT_SIZES,
  className,
  eager = false,
  width,
  height,
}: {
  base: string;
  alt: string;
  sizes?: string;
  className?: string;
  eager?: boolean;
  width?: number;
  height?: number;
}) {
  const [found, setFound] = useState<{ avif: number[]; webp: number[]; jpg: number[] } | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const a = await detectAvailable(base);
      if (!alive) return;
      setFound(a);

      const jpgFallback = a.jpg[0] ?? FALLBACK_WIDTH_DEFAULT;
      const url = `${base}-${jpgFallback}.jpg`;
      const n = await getNaturalSize(url);
      if (!alive) return;
      setNat(n);
    })();
    return () => {
      alive = false;
    };
  }, [base]);

  // kezdeti JPG: a várható végső JPG szélessége (ha ismert) → elkerülhető a dupla letöltés
  const provisionalJpg = found?.jpg?.[0] ?? FALLBACK_WIDTH_DEFAULT;
  const immediateSrc = `${base}-${provisionalJpg}.jpg`;

  if (!found || !nat) {
    return (
      <img
        src={immediateSrc}
        alt={alt}
        class={className}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchpriority={eager ? 'high' : 'auto'}
      />
    );
  }

  const { avif, webp, jpg } = found;
  const jpgFallback = jpg[0] ?? FALLBACK_WIDTH_DEFAULT;

  return (
    <picture>
      {avif.length > 0 && <source type="image/avif" srcSet={buildSrcset(base, 'avif', avif)} sizes={sizes} />}
      {webp.length > 0 && <source type="image/webp" srcSet={buildSrcset(base, 'webp', webp)} sizes={sizes} />}
      <img
        src={`${base}-${jpgFallback}.jpg`}
        srcSet={jpg.length > 0 ? buildSrcset(base, 'jpg', jpg) : undefined}
        sizes={sizes}
        alt={alt}
        class={className}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchpriority={eager ? 'high' : 'auto'}
        width={nat.w}
        height={nat.h}
      />
    </picture>
  );
}

export default function ProductGallery({ product }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // <-- PhotoSwipe ref
  const emblaRef = useRef<ReturnType<typeof EmblaCarousel> | null>(null);
  const lbRef = useRef<PhotoSwipeLightbox | null>(null);
  const [selected, setSelected] = useState(0);

  const images = normalizeImages(product);
  if (images.length === 0) return null;

  // per-kép lightbox target (href + természetes méret)
  const [lbTargets, setLbTargets] = useState<Array<{ url: string; w: number; h: number }>>([]);

  // Lightbox targetek párhuzamos, cache-elt felderítése
  useEffect(() => {
    let alive = true;
    (async () => {
      const targets = await Promise.all(images.map((img) => pickLightboxTarget(img.base)));
      if (alive) setLbTargets(targets);
    })();
    return () => {
      alive = false;
    };
  }, [images.map((i) => i.base).join('|')]);

  // Embla csak több képnél
  useEffect(() => {
    if (viewportRef.current && images.length > 1 && !emblaRef.current) {
      const embla = EmblaCarousel(viewportRef.current, { loop: true });
      emblaRef.current = embla;
      const onSelect = () => setSelected(embla.selectedScrollSnap());
      embla.on('select', onSelect);
      onSelect();
      return () => {
        embla.off('select', onSelect);
        embla.destroy();
        emblaRef.current = null;
      };
    }
  }, [images.length]);

  // PhotoSwipe init — ref-alapú (nincs id, nincs ütközés több példány között)
  useEffect(() => {
    if (typeof window === 'undefined') return; // SSR guard
    if (!containerRef.current || images.length === 0) return;

    // tisztítás, ha maradt korábbi
    if (lbRef.current) {
      lbRef.current.destroy();
      lbRef.current = null;
    }

    const lb = new PhotoSwipeLightbox({
      gallery: containerRef.current, // <-- element, nem selector
      children: 'a',
      pswpModule: () => import('photoswipe'),
      initialZoomLevel: 'fit',
      secondaryZoomLevel: 1.5,
      maxZoomLevel: 3,
      padding: { top: 24, bottom: 24, left: 12, right: 12 },
      wheelToZoom: true,
      imageClickAction: 'zoom-or-close',
      bgOpacity: 0.95,
    } as any);

    lb.init();
    lbRef.current = lb;

    return () => {
      lb.destroy();
      lbRef.current = null;
    };
  }, [images.map((i) => i.base).join('|')]);

  const goTo = (i: number) => emblaRef.current?.scrollTo(i);
  const prev = (e?: Event) => {
    e?.stopPropagation();
    emblaRef.current?.scrollPrev();
  };
  const next = (e?: Event) => {
    e?.stopPropagation();
    emblaRef.current?.scrollNext();
  };

  // ——— egy kép esetén
  if (images.length === 1) {
    const img = images[0];
    const target = lbTargets[0];
    const href = target?.url ?? `${img.base}-${LIGHTBOX_DEFAULT_W}.jpg`;
    const w = target?.w ?? LIGHTBOX_DEFAULT_W;
    const h = target?.h ?? LIGHTBOX_DEFAULT_H;

    return (
      <div class="w-full" style="aspect-ratio: 2 / 3;">
        <a
          ref={containerRef as any}
          href={href}
          data-pswp-width={w}
          data-pswp-height={h}
          class="block cursor-zoom-in"
        >
          <PictureDynamic
            base={img.base}
            alt={img.alt}
            sizes={DEFAULT_SIZES}
            eager
            className="w-full max-h-[70vh] object-contain rounded-lg"
          />
        </a>
      </div>
    );
  }

  // ——— több kép esetén
  return (
    <div class="w-full relative">
      <div class="overflow-hidden rounded-lg relative" ref={viewportRef}>
        <div class="flex" ref={containerRef}>
          {images.map((img, i) => {
            const target = lbTargets[i];
            const href = target?.url ?? `${img.base}-${LIGHTBOX_DEFAULT_W}.jpg`;
            const w = target?.w ?? LIGHTBOX_DEFAULT_W;
            const h = target?.h ?? LIGHTBOX_DEFAULT_H;

            return (
              <a
                key={img.base || i}
                href={href}
                data-pswp-width={w}
                data-pswp-height={h}
                class="flex-[0_0_100%] min-w-0 cursor-zoom-in block"
                onClick={() => setSelected(i)}
              >
                <PictureDynamic
                  base={img.base}
                  alt={img.alt}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 800px"
                  eager={i === 0}
                  width={1200}
                  height={800}
                  className="w-full max-h-[70vh] object-contain"
                />
              </a>
            );
          })}
        </div>

        {/* nav gombok */}
        <div class="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-1 pointer-events-none md:hidden lg:flex">
          <button
            type="button"
            aria-label="Előző kép"
            onClick={(e) => prev(e as any)}
            class="pointer-events-auto h-9 w-9 grid place-items-center rounded-full 
                   bg-white/80 border border-gray-200 shadow hover:bg-white 
                   active:scale-95 backdrop-blur 
                   dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Következő kép"
            onClick={(e) => next(e as any)}
            class="pointer-events-auto h-9 w-9 grid place-items-center rounded-full 
                   bg-white/80 border border-gray-200 shadow hover:bg-white 
                   active:scale-95 backdrop-blur
                   dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            ›
          </button>
        </div>

        {/* pont indikátorok mobilon */}
        <div class="absolute bottom-2 left-0 right-0 flex justify-center gap-2 pointer-events-none z-[1] lg:hidden">
          {images.map((_, i) => {
            const isActive = i === selected;
            return (
              <button
                key={i}
                type="button"
                aria-label={`Ugrás a(z) ${i + 1}. képre`}
                aria-current={isActive ? 'true' : 'false'}
                onClick={(e) => {
                  (e as any).stopPropagation();
                  goTo(i);
                }}
                class={`pointer-events-auto h-2.5 w-2.5 rounded-full border transition
                  ${isActive ? 'bg-orange-500 border-orange-500'
                    : 'bg-white/80 border-white hover:bg-white'}`}
              />
            );
          })}
        </div>
      </div>

      {/* thumbs — külön thumbs fájl nélkül a -500 variánst használjuk */}
      <div class="hidden md:flex gap-2 mt-4 overflow-x-auto no-scrollbar">
        {images.map((img, i) => {
          const isActive = i === selected;
          return (
            <button
              key={img.base || i}
              type="button"
              aria-label={`Kép ${i + 1}`}
              onClick={() => goTo(i)}
              class={`h-16 w-16 rounded overflow-hidden border transition
                      ${isActive ? 'border-orange-500 ring-2 ring-orange-500'
                        : 'border-gray-200 hover:ring-2 hover:ring-orange-400'}`}
            >
              <img
                src={`${img.base}-${THUMB_WIDTH}.jpg`}
                alt={img.alt}
                class="h-full w-full object-contain"
                loading="lazy"
                decoding="async"
                width={THUMB_WIDTH}
                height={Math.round((THUMB_WIDTH * 3) / 4)}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
