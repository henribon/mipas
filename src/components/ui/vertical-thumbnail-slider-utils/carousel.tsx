'use client';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaOptionsType, EmblaCarouselType } from 'embla-carousel';
import { cn } from '@/lib/utils';

type Miniatura = { indice: number; src: string };

type CarouselContexto = {
  emblaRef: (node: HTMLElement | null) => void;
  emblaApi: EmblaCarouselType | undefined;
  thumbsRef: (node: HTMLElement | null) => void;
  thumbsApi: EmblaCarouselType | undefined;
  selecionado: number;
  irPara: (i: number) => void;
  total: number;
  registrar: (m: Miniatura) => void;
  miniaturas: Miniatura[];
  eixo: 'x' | 'y';
};

const Ctx = createContext<CarouselContexto | null>(null);
const usarCarousel = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('Componentes do Carousel precisam ficar dentro de <Carousel>');
  return c;
};

export function Carousel({
  children,
  options,
  className,
  isAutoPlay,
}: {
  children: ReactNode;
  options?: EmblaOptionsType;
  className?: string;
  isAutoPlay?: boolean;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel(options);
  const [thumbsRef, thumbsApi] = useEmblaCarousel({
    axis: options?.axis,
    direction: options?.direction,
    containScroll: 'keepSnaps',
    dragFree: true,
  });

  const [selecionado, setSelecionado] = useState(0);
  const [total, setTotal] = useState(0);
  const [miniaturas, setMiniaturas] = useState<Miniatura[]>([]);

  const registrar = useCallback((m: Miniatura) => {
    setMiniaturas(atual => {
      if (atual.some(x => x.indice === m.indice && x.src === m.src)) return atual;
      const fora = atual.filter(x => x.indice !== m.indice);
      return [...fora, m].sort((a, b) => a.indice - b.indice);
    });
  }, []);

  const irPara = useCallback(
    (i: number) => {
      if (emblaApi) emblaApi.scrollTo(i);
    },
    [emblaApi],
  );

  // O Embla mede o carrossel na montagem; dentro do visualizador as imagens
  // ainda não têm tamanho nesse instante, então uma remedição logo depois
  // evita que ele fique com as posições erradas.
  useEffect(() => {
    if (!emblaApi) return;
    const t = setTimeout(() => emblaApi.reInit(), 60);
    return () => clearTimeout(t);
  }, [emblaApi, miniaturas.length]);

  useEffect(() => {
    if (!emblaApi) return;
    const aoSelecionar = () => {
      const i = emblaApi.selectedScrollSnap();
      setSelecionado(i);
      if (thumbsApi) thumbsApi.scrollTo(i);
    };
    const aoRecalcular = () => setTotal(emblaApi.scrollSnapList().length);
    aoSelecionar();
    aoRecalcular();
    emblaApi.on('select', aoSelecionar).on('reInit', aoSelecionar).on('reInit', aoRecalcular);
    return () => {
      emblaApi.off('select', aoSelecionar).off('reInit', aoSelecionar).off('reInit', aoRecalcular);
    };
  }, [emblaApi, thumbsApi]);

  useEffect(() => {
    if (!emblaApi || !isAutoPlay) return;
    const id = setInterval(() => {
      if (emblaApi.canScrollNext()) emblaApi.scrollNext();
      else emblaApi.scrollTo(0);
    }, 4000);
    return () => clearInterval(id);
  }, [emblaApi, isAutoPlay]);

  return (
    <Ctx.Provider
      value={{
        emblaRef,
        emblaApi,
        thumbsRef,
        thumbsApi,
        selecionado,
        irPara,
        total,
        registrar,
        miniaturas,
        eixo: options?.axis === 'y' ? 'y' : 'x',
      }}
    >
      <div className={className}>{children}</div>
    </Ctx.Provider>
  );
}

export function SliderContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { emblaRef, emblaApi, eixo } = usarCarousel();
  const ultimoGiro = useRef(0);

  // A roda do mouse não é tratada pelo Embla. O acumulado evita que um único
  // giro do trackpad, que dispara vários eventos, pule várias fotos de uma vez.
  const aoGirar = useCallback(
    (ev: React.WheelEvent) => {
      if (!emblaApi) return;
      const delta = eixo === 'y' ? ev.deltaY : ev.deltaX || ev.deltaY;
      if (Math.abs(delta) < 8) return;
      const agora = Date.now();
      if (agora - ultimoGiro.current < 320) return;
      ultimoGiro.current = agora;
      if (delta > 0) emblaApi.scrollNext();
      else emblaApi.scrollPrev();
    },
    [emblaApi, eixo],
  );

  // A altura precisa estar na viewport (o elemento da ref): é o recorte dela
  // que o Embla rola. Deixando só no contêiner interno, não há transbordo e
  // o carrossel fica parado.
  // touch-action solta o gesto no eixo do carrossel para o Embla: sem isso o
  // navegador trata o arraste como rolagem da página e o dedo não move nada.
  return (
    <div
      className={cn('overflow-hidden', eixo === 'y' ? 'touch-pan-x' : 'touch-pan-y', className)}
      onWheel={aoGirar}
      ref={emblaRef}
    >
      <div className={cn('flex h-full', eixo === 'y' && 'flex-col', className)}>
        {React.Children.map(children, (filho, i) =>
          React.isValidElement(filho)
            ? React.cloneElement(filho as React.ReactElement<any>, { indiceDoSlide: i })
            : filho,
        )}
      </div>
    </div>
  );
}

export function Slider({
  children,
  className,
  thumbnailSrc,
  indiceDoSlide = 0,
}: {
  children: ReactNode;
  className?: string;
  thumbnailSrc?: string;
  indiceDoSlide?: number;
}) {
  const { registrar } = usarCarousel();

  useEffect(() => {
    if (thumbnailSrc) registrar({ indice: indiceDoSlide, src: thumbnailSrc });
  }, [indiceDoSlide, thumbnailSrc, registrar]);

  return <div className={cn('min-w-0 shrink-0 grow-0 basis-full', className)}>{children}</div>;
}

export function ThumbsSlider({
  className,
  thumbsClassName,
  thumbsSliderClassName,
}: {
  className?: string;
  thumbsClassName?: string;
  thumbsSliderClassName?: string;
}) {
  const { thumbsRef, miniaturas, selecionado, irPara, eixo } = usarCarousel();
  if (miniaturas.length === 0) return null;
  return (
    <div className={cn('overflow-hidden', className, thumbsClassName)} ref={thumbsRef}>
      <div className={cn('flex gap-2', eixo === 'y' && 'flex-col', thumbsClassName)}>
        {miniaturas.map(m => (
          <button
            key={m.indice}
            type="button"
            data-indice={m.indice}
            aria-label={`Ver foto ${m.indice + 1}`}
            onClick={() => irPara(m.indice)}
            className={cn(
              'relative shrink-0 grow-0 overflow-hidden rounded-lg border-2 transition',
              selecionado === m.indice ? 'opacity-100' : 'border-transparent opacity-50 hover:opacity-80',
              selecionado === m.indice && thumbsSliderClassName,
              eixo === 'y' ? 'h-16 w-full' : 'h-16 w-16',
            )}
          >
            <img src={m.src} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function SliderDotButton({
  className,
  activeclass,
}: {
  className?: string;
  activeclass?: string;
}) {
  const { total, selecionado, irPara } = usarCarousel();
  if (total <= 1) return null;
  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => irPara(i)}
          className={cn(
            'h-2 w-2 rounded-full transition',
            selecionado === i ? cn('bg-primary w-5', activeclass) : 'bg-muted-foreground/40',
          )}
        />
      ))}
    </div>
  );
}

export default Carousel;
