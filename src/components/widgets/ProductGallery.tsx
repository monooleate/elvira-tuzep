import { useEffect, useRef, useState } from 'preact/hooks';
import EmblaCarousel from 'embla-carousel';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';

type ImageItem = { src: string; alt: string };
type Props = { product: any };

export default function ProductGallery({ product }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const emblaRef = useRef<ReturnType<typeof EmblaCarousel> | null>(null);
  const lbRef = useRef<PhotoSwipeLightbox | null>(null);
  const [selected, setSelected] = useState(0);

  // Képlista (compat)
  const images: ImageItem[] = Array.isArray(product.images)
    ? product.images
    : product.image
    ? [{ src: product.image, alt: product.name }]
    : [];

  // Embla
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

  // Lightbox
  useEffect(() => {
    if (images.length > 0) {
      const lb = new PhotoSwipeLightbox({
        gallery: '#pswp-gallery',
        children: 'a',
        pswpModule: () => import('photoswipe'),
      });
      lb.init();
      lbRef.current = lb;

      return () => {
        lb.destroy();
        lbRef.current = null;
      };
    }
  }, [images.length]);

  const goTo = (i: number) => emblaRef.current?.scrollTo(i);
  const prev = (e?: Event) => { e?.stopPropagation(); emblaRef.current?.scrollPrev(); };
  const next = (e?: Event) => { e?.stopPropagation(); emblaRef.current?.scrollNext(); };

  if (images.length === 0) return null;

  return (
    <div class="w-full relative">
      {/* Fő carousel (relative szülő az overlay-ekhez) */}
      <div class="overflow-hidden rounded-lg relative" ref={viewportRef}>
        <div id="pswp-gallery" class="flex">
          {images.map((img, i) => (
            <a
              key={i}
              href={img.src}
              data-pswp-width="1600"
              data-pswp-height="1200"
              class="flex-[0_0_100%] min-w-0 cursor-zoom-in block"
              onClick={() => setSelected(i)}
            >
              <img
                src={img.src}
                alt={img.alt}
                class="w-full h-80 object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                {...(i === 0 ? { fetchpriority: 'high' as const } : {})}
              />
            </a>
          ))}
        </div>

{images.length > 1 && (
  <div class="absolute inset-y-0 left-0 right-0 items-center justify-between px-1 pointer-events-none flex md:hidden lg:flex">
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
)}



        {images.length > 1 && (
          <div class="absolute bottom-2 left-0 right-0 flex justify-center gap-2 pointer-events-none z-[1] lg:hidden">
            {images.map((_, i) => {
              const isActive = i === selected;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Ugrás a(z) ${i + 1}. képre`}
                  aria-current={isActive ? 'true' : 'false'}
                  onClick={(e) => { e.stopPropagation(); goTo(i); }}
                  class={`pointer-events-auto h-2.5 w-2.5 rounded-full border transition
                    ${isActive
                      ? 'bg-orange-500 border-orange-500'
                      : 'bg-white/80 border-white hover:bg-white'}`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Thumbnails – md és fölötte (külön blokk a kép alatt) */}
      {images.length > 1 && (
        <div class="hidden md:flex gap-2 mt-4 overflow-x-auto no-scrollbar">
          {images.map((img, i) => {
            const isActive = i === selected;
            return (
              <button
                key={i}
                type="button"
                aria-label={`Kép ${i + 1}`}
                onClick={() => goTo(i)}
                class={`h-16 w-16 rounded overflow-hidden border transition
                        ${isActive ? 'border-orange-500 ring-2 ring-orange-500' : 'border-gray-200 hover:ring-2 hover:ring-orange-400'}`}
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  class="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
