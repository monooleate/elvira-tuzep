import { useEffect, useRef, useState } from 'preact/hooks';
import EmblaCarousel from 'embla-carousel';

type Slide = {
  image: string | { src: string };  // <-- bővítve
  alt: string;
  href?: string;
  label?: string;
  sublabel?: string;
};


type Props = {
  slides: Slide[];
  intervalMs?: number;
  showArrows?: boolean;
};

export default function HeroCarousel({ slides, intervalMs = 5000, showArrows = true }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const emblaRef = useRef<ReturnType<typeof EmblaCarousel> | null>(null);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!viewportRef.current || slides.length <= 1) return;
    const embla = EmblaCarousel(viewportRef.current, { loop: true, align: 'start' });
    emblaRef.current = embla;
    const onSelect = () => setIndex(embla.selectedScrollSnap());
    embla.on('select', onSelect);
    onSelect();
    return () => { embla.off('select', onSelect); embla.destroy(); emblaRef.current = null; };
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReduced) return;

    let t: number | null = null;
    const tick = () => {
      if (!emblaRef.current) return;
      if (!hovered && !document.hidden) emblaRef.current.scrollNext();
      t = window.setTimeout(tick, intervalMs);
    };
    t = window.setTimeout(tick, intervalMs);

    const onVis = () => {
      if (t) { clearTimeout(t); t = null; }
      if (!document.hidden) t = window.setTimeout(tick, intervalMs);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { if (t) clearTimeout(t); document.removeEventListener('visibilitychange', onVis); };
  }, [intervalMs, hovered, slides.length]);

  const goTo = (i: number) => emblaRef.current?.scrollTo(i);
  const prev = () => emblaRef.current?.scrollPrev();
  const next = () => emblaRef.current?.scrollNext();

  const toUrl = (img: Slide['image']) =>
  typeof img === 'string' ? img : (img?.src ?? '');

  if (!slides?.length) return null;

  return (
    <div class="relative w-full" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div class="overflow-hidden rounded-2xl" ref={viewportRef}>
        <div class="flex">
          {slides.map((s, i) => {
            const Img = (
              <img
                src={toUrl(s.image)}
                alt={s.alt}
                class="w-full h-[48vh] sm:h-[56vh] lg:h-[70vh] object-contain"
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                {...(i === 0 ? { fetchpriority: 'high' as const } : {})}
              />
            );
            const Overlay = (s.label || s.sublabel) && (
              <div class="absolute inset-0 grid place-items-center">
                <div class="bg-black/35 dark:bg-black/40 text-white px-4 py-3 rounded-xl shadow max-w-[90%] text-center">
                  {s.label && <div class="text-lg sm:text-xl font-semibold">{s.label}</div>}
                  {s.sublabel && <div class="text-sm sm:text-base opacity-90">{s.sublabel}</div>}
                </div>
              </div>
            );
            return (
              <div key={i} class="relative flex-[0_0_100%] min-w-0">
                {s.href ? (
                  <a href={s.href} class="block focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-2xl">
                    {Img}{Overlay}
                  </a>
                ) : (
                  <div class="relative">{Img}{Overlay}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* pöttyök (narancs) */}
      {slides.length > 1 && (
        <div class="absolute bottom-3 left-0 right-0 flex justify-center gap-2 pointer-events-none z-[1]">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ugrás a(z) ${i + 1}. bannerre`}
              aria-current={i === index ? 'true' : 'false'}
              onClick={(e) => { e.stopPropagation(); goTo(i); }}
              class={`pointer-events-auto h-2.5 w-2.5 rounded-full border transition
                ${i === index
                  ? 'bg-orange-500 border-orange-500'
                  : 'bg-black/80 border-white hover:bg-gray-800 dark:bg-gray-800/80 dark:border-gray-700 dark:hover:bg-gray-800'}`}
            />
          ))}
        </div>
      )}

      {/* nyilak */}
      {slides.length > 1 && (
        <div class="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 pointer-events-none">
          <button
            type="button"
            aria-label="Előző banner"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            class="pointer-events-auto h-10 w-10 grid place-items-center rounded-full
                   bg-white/80 border border-gray-200 shadow hover:bg-white active:scale-95 backdrop-blur
                   dark:bg-gray-800/80 dark:border-gray-600 dark:hover:bg-gray-800"
          >‹</button>
          <button
            type="button"
            aria-label="Következő banner"
            onClick={(e) => { e.stopPropagation(); next(); }}
            class="pointer-events-auto h-10 w-10 grid place-items-center rounded-full
                   bg-white/80 border border-gray-200 shadow hover:bg-white active:scale-95 backdrop-blur
                   dark:bg-gray-800/80 dark:border-gray-600 dark:hover:bg-gray-800"
          >›</button>
        </div>
      )}
    </div>
  );
}
