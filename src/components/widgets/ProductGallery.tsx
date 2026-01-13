// src/components/ProductGallery.tsx
import { useEffect, useRef, useState } from 'preact/hooks';
import EmblaCarousel from 'embla-carousel';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';

type RawImage = { src: string; alt?: string } | string;
type ImageItem =
  | { kind: 'direct'; url: string; alt: string }   // teljes fájlút – nincs -500
  | { kind: 'base'; base: string; alt: string };   // variánsos – lehet -500, -1200 stb.

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
  const name = product?.name ?? 'Termékkép'

  const hasImageString =
    typeof product?.image === 'string' && product.image.trim() !== ''

      // 2) Ha image nincs / null → nézd az images-t
  if (Array.isArray(product?.images)) {
    if (product.images.length > 0) {
      // images tömb esetén a meglévő logikát megtartjuk (variánsos base)
      return product.images.map((it: RawImage) => {
        const src = typeof it === 'string' ? it : it.src
        const alt = typeof it === 'string' ? name : (it.alt ?? name)
        return { kind: 'base', base: toBase(src), alt }
      })
    }

  // 1) Ha image string → ezt használd, DIRECT módban (ne variánsozzon)
  if (hasImageString) {
    return [{ kind: 'direct', url: product.image.trim(), alt: name }]
  }


    // 3) Ha images üres tömb és image string lenne → már az elején visszatértünk
    // itt nem kell semmi
  }

  // 4) Ha image tömb (ritkább edge case), akkor variánsos base-ként kezelem
  if (Array.isArray(product?.image) && product.image.length > 0) {
    return product.image.map((it: RawImage) => {
      const src = typeof it === 'string' ? it : it.src
      const alt = typeof it === 'string' ? name : (it.alt ?? name)
      return { kind: 'base', base: toBase(src), alt }
    })
  }

  return []
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

async function pickLightboxTargetFromDirect(url: string) {
  const nat = await getNaturalSize(url)
  return { url, w: nat.w, h: nat.h }
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
      const targets = await Promise.all(
        images.map((img) =>
          img.kind === 'base'
            ? pickLightboxTarget(img.base)
            : Promise.resolve({ url: img.url, w: LIGHTBOX_DEFAULT_W, h: LIGHTBOX_DEFAULT_H })
        )
      );
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
 // PhotoSwipe init — csak több képnél vagy base-es képeknél
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!containerRef.current || images.length === 0) return

    // ha csak 1 direct image van → NE indítsd a lightboxot
    if (images.length === 1 && images[0].kind === 'direct') return

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

  // ha direct típusú (string image) → NINCS lightbox
  if (img.kind === "direct") {
    return (
      <div class="w-full lg:aspect-[6/7]">
        <img
          src={img.url}
          alt={img.alt}
          class="w-full max-h-[70vh] object-contain rounded-lg"
          loading="eager"
          decoding="async"
          fetchpriority="high"
        />
      </div>
    );
  }

  // ha base → működjön a lightbox
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
          const href =
            img.kind === "base"
              ? target?.url ?? `${img.base}-${LIGHTBOX_DEFAULT_W}.jpg`
              : img.url;
          const w = target?.w ?? LIGHTBOX_DEFAULT_W;
          const h = target?.h ?? LIGHTBOX_DEFAULT_H;

          return (
            <a
              key={img.kind === "base" ? img.base : img.url}
              href={href}
              data-pswp-width={w}
              data-pswp-height={h}
              class="flex-[0_0_100%] min-w-0 cursor-zoom-in block"
              onClick={() => setSelected(i)}
            >
              {img.kind === "base" ? (
                <PictureDynamic
                  base={img.base}
                  alt={img.alt}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 800px"
                  eager={i === 0}
                  width={1200}
                  height={800}
                  className="w-full max-h-[70vh] object-contain"
                />
              ) : (
                <img
                  src={img.url}
                  alt={img.alt}
                  class="w-full max-h-[70vh] object-contain"
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
              )}
            </a>
          );
        })}
      </div>

      {/* navigációs gombok */}
      <div class="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 pointer-events-none md:hidden lg:flex">
        <button
          type="button"
          aria-label="Előző kép"
          onClick={(e) => {
            e.stopPropagation();
            emblaRef.current?.scrollPrev();
          }}
          class="pointer-events-auto h-12 w-12 text-2xl grid place-items-center rounded-full 
                bg-white/80 border border-gray-200 shadow hover:bg-white 
                active:scale-95 backdrop-blur 
                dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          <span class="relative bottom-[2px]">‹</span>
        </button>
        <button
          type="button"
          aria-label="Következő kép"
          onClick={(e) => {
            e.stopPropagation();
            emblaRef.current?.scrollNext();
          }}
          class="pointer-events-auto h-12 w-12 text-2xl grid place-items-center rounded-full 
                bg-white/80 border border-gray-200 shadow hover:bg-white 
                active:scale-95 backdrop-blur
                dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          <span class="relative bottom-[2px]">›</span>
        </button>
      </div>

      {/* pont indikátorok mobilon */}
      <div class="mt-2 flex justify-center gap-2 pointer-events-none z-[1] md:hidden">
        {images.map((_, i) => {
          const isActive = i === selected;
          return (
            <button
              key={i}
              type="button"
              aria-label={`Ugrás a(z) ${i + 1}. képre`}
              aria-current={isActive ? "true" : "false"}
              onClick={(e) => {
                e.stopPropagation();
                emblaRef.current?.scrollTo(i);
              }}
              class={`pointer-events-auto h-2.5 w-2.5 rounded-full border transition
                ${
                  isActive
                    ? "bg-orange-500 border-orange-500"
                    : "bg-gray-400/80 border-gray-400 hover:bg-gray-500 dark:bg-white/80 dark:border-white dark:hover:bg-white"
                }`}
            />
          );
        })}
      </div>
    </div>

    {/* thumbs */}
    <div class="hidden md:flex gap-2 mt-4 overflow-x-auto no-scrollbar">
      {images.map((img, i) => {
        const isActive = i === selected;
        const thumbSrc =
          img.kind === "base"
            ? `${img.base}-${THUMB_WIDTH}.jpg`
            : img.url;

        return (
          <button
            key={img.kind === "base" ? img.base : img.url}
            type="button"
            aria-label={`Kép ${i + 1}`}
            onClick={() => emblaRef.current?.scrollTo(i)}
            class={`h-16 w-16 rounded overflow-hidden border transition
                    ${
                      isActive
                        ? "border-orange-500 ring-2 ring-orange-500"
                        : "border-gray-200 hover:ring-2 hover:ring-orange-400"
                    }`}
          >
            <img
              src={thumbSrc}
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
