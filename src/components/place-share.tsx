import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Navigation, Share } from 'lucide-react';
import * as data from '@/data';
import { errorDetail } from '@/errors';
import { shortAddress } from '@/geocoding';
import { Button } from '@/components/ui/button';
import { ListIcon } from '@/components/list-icon';
import { HomeButton, RichText } from '@/components/mipas';
import { cn } from '@/lib/utils';
import {
  appUrl, googleMapsDirectionsUrl, googleMapsEmbedUrl, googleMapsSearchUrl,
  instagramHandle, instagramUrl, isPlaceId, placeShareUrl, shareOrCopy,
} from '@/share';

// The page a shared link (?place=<uuid>) opens: one place as a card, for someone
// who has never seen the app. Link colors carry "!" because index.css styles every <a>
// outside Tailwind's layers, which would win over a plain utility.

type Load =
  | { status: 'loading' }
  | { status: 'ready'; place: any }
  | { status: 'missing' }
  | { status: 'error'; detail: string };

export function PlaceSharePage({ placeId }: { placeId: string }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isPlaceId(placeId)) {
      setLoad({ status: 'missing' });
      return;
    }
    let cancelled = false;
    setLoad({ status: 'loading' });
    data.fetchSharedPlace(placeId)
      .then(place => {
        if (cancelled) return;
        if (!place) {
          setLoad({ status: 'missing' });
          return;
        }
        setLoad({ status: 'ready', place });
        data.signMissingPhotoUrls([place])
          .then(urls => {
            if (cancelled || !urls) return;
            setLoad(cur => (cur.status === 'ready' ? { status: 'ready', place: data.applyPhotoUrls([cur.place], urls)[0] } : cur));
          })
          .catch(e => console.error('[Mipas] não deu pra assinar URLs de foto:', e));
      })
      .catch(e => {
        if (cancelled) return;
        console.error('[Mipas] não deu pra carregar o lugar compartilhado:', e);
        setLoad({ status: 'error', detail: errorDetail(e) });
      });
    return () => { cancelled = true; };
  }, [placeId, attempt]);

  const place = load.status === 'ready' ? load.place : null;

  useEffect(() => {
    document.title = place ? `${place.name} · Mipas` : 'Mipas';
  }, [place?.name]);

  return (
    <div className="fixed inset-0 overflow-y-auto bg-paper">
      <div className="mx-auto box-border flex min-h-full w-full max-w-[460px] flex-col px-4 pb-10 pt-4">
        <header className="mb-3.5 flex items-center justify-between">
          <a href={appUrl()} title="Abrir o Mipas" className="font-display text-[20px] leading-none tracking-wide !text-ink no-underline">
            Mipas
          </a>
          <HomeButton />
        </header>

        {load.status === 'loading' && <CardSkeleton />}
        {place && <PlaceShareCard place={place} />}
        {load.status === 'missing' && (
          <Notice
            title="Esse lugar não está disponível"
            text="O link pode estar incompleto, ou quem mandou parou de compartilhar esse lugar."
          />
        )}
        {load.status === 'error' && (
          <Notice
            title="Não deu pra abrir esse lugar"
            text={load.detail}
            action={<Button onClick={() => setAttempt(n => n + 1)} size="sm">Tentar de novo</Button>}
          />
        )}

        {load.status !== 'loading' && (
          <a href={appUrl()} className="mx-auto mt-6 text-[12.5px] font-semibold !text-sub no-underline hover:!text-ink">
            Ver o mapa do Mipas →
          </a>
        )}
      </div>
    </div>
  );
}

// The cover photo leads, then the rest in the owner's order.
function orderedPhotos(place) {
  const photos = (place.photos || []);
  const cover = photos.find(ph => ph.id === place.cover_photo_id);
  return cover ? [cover, ...photos.filter(ph => ph !== cover)] : photos;
}

function PlaceShareCard({ place }) {
  const photos = useMemo(() => orderedPhotos(place), [place]);
  const publicLists = (place.lists || []).filter(l => l.is_public);
  const handle = place.instagram ? instagramHandle(place.instagram) : '';
  const hasPhotos = photos.length > 0;
  const price = place.avg_price != null
    ? Number(place.avg_price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;

  return (
    <article className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_18px_50px_rgba(0,0,0,.22)]">
      {hasPhotos
        ? <PhotoCarousel photos={photos} name={place.name} />
        : <MapEmbed place={place} eager className="aspect-square" />}

      <div className="px-5 pb-5 pt-4">
        {publicLists.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {publicLists.map(l => (
              <a key={l.id} href={appUrl(`?list=${l.id}`)} title="Ver a lista inteira"
                className="inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-[12px] font-bold no-underline transition hover:opacity-80"
                style={{ background: l.color + '1E', color: l.color }}>
                <ListIcon list={l} size={18} radius={99} />
                <span className="truncate">{l.name}</span>
              </a>
            ))}
          </div>
        )}

        <h1 className="m-0 font-display text-[27px] font-normal uppercase leading-[1.05] tracking-[.02em] text-ink [overflow-wrap:anywhere]">
          {place.name}
        </h1>

        <a href={googleMapsSearchUrl(place)} target="_blank" rel="noopener noreferrer" title="Abrir no Google Maps"
          className="mt-2 inline-flex items-start gap-1.5 text-[13.5px] font-medium leading-snug !text-sub no-underline hover:underline">
          <MapPin size={15} strokeWidth={2} className="mt-px shrink-0" />
          <span>{shortAddress(place.address)}</span>
        </a>

        {(place.rating != null || place.category || price) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {place.rating != null && (
              <span className="inline-flex items-baseline gap-1 rounded-full bg-coral/12 px-3 py-1 text-coral" title="Nota de quem guardou">
                <span className="text-[12px]">★</span>
                <span className="font-display text-[17px] leading-none">{place.rating}</span>
                <span className="text-[11px] font-bold opacity-70">/10</span>
              </span>
            )}
            {place.category && <Chip>{place.category}</Chip>}
            {price && <Chip title="Valor médio por pessoa">~ R$ {price}</Chip>}
          </div>
        )}

        {place.description && (
          <RichText html={place.description}
            style={{ marginTop: 14, fontSize: 14.5, fontWeight: 500, lineHeight: 1.5, color: 'var(--ink)' }} />
        )}

        {/* Side by side when the handle fits next to "Como chegar", stacked when it doesn't. */}
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={googleMapsDirectionsUrl(place)} target="_blank" rel="noopener noreferrer"
            className="inline-flex flex-[1_1_140px] items-center justify-center gap-2 rounded-3xl bg-coral px-4 py-3 text-[13.5px] font-semibold !text-coral-texto no-underline shadow-md transition hover:opacity-85">
            <Navigation size={15} strokeWidth={2.2} className="shrink-0" />
            Como chegar
          </a>
          {handle && (
            <a href={instagramUrl(place.instagram)} target="_blank" rel="noopener noreferrer" title="Abrir no Instagram"
              className="inline-flex min-w-0 max-w-full flex-auto items-center justify-center gap-2 rounded-3xl px-4 py-3 text-[13.5px] font-semibold !text-white no-underline shadow-md transition hover:opacity-90"
              style={{ background: 'linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)' }}>
              <InstagramGlyph />
              <span className="truncate">@{handle}</span>
            </a>
          )}
        </div>
      </div>

      {hasPhotos && (
        <div className="border-t border-line px-5 pb-5 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-sub">No mapa</span>
            <a href={googleMapsSearchUrl(place)} target="_blank" rel="noopener noreferrer"
              className="text-[12px] font-semibold !text-sub no-underline hover:!text-ink">
              Abrir no Google Maps ↗
            </a>
          </div>
          <MapEmbed place={place} className="mt-2.5 aspect-[16/10] rounded-xl" />
        </div>
      )}

      <footer className="flex items-center gap-3 border-t border-line px-5 py-3.5">
        <span className="text-[12px] font-semibold leading-snug text-sub">Um lugar guardado no Mipas</span>
        <ShareButton place={place} />
      </footer>
    </article>
  );
}

function Chip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className="rounded-full bg-cream px-3 py-1.5 text-[12.5px] font-bold leading-none text-sub">
      {children}
    </span>
  );
}

function PhotoCarousel({ photos, name }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const many = photos.length > 1;

  const onScroll = () => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const i = Math.max(0, Math.min(photos.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
    setIndex(i);
  };

  const go = (i) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  const atual = photos[index];

  return (
    <div className="relative aspect-[4/5] w-full bg-cream">
      <div ref={track} onScroll={onScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]">
        {photos.map((ph, i) => (
          <div key={ph.id} className="relative h-full w-full shrink-0 snap-center">
            {ph.url
              ? <img src={ph.url} alt={ph.title || name} draggable={false} loading={i < 2 ? 'eager' : 'lazy'}
                  className="block h-full w-full select-none object-cover" />
              : <div className="h-full w-full animate-pulse bg-cream" />}
          </div>
        ))}
      </div>

      {atual?.title && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-7 pt-12">
          <div className="text-[13.5px] font-bold leading-snug text-white [text-shadow:0_1px_8px_rgba(0,0,0,.5)]">{atual.title}</div>
        </div>
      )}

      {many && (
        <React.Fragment>
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] font-bold text-white">
            {index + 1}/{photos.length}
          </span>
          {index > 0 && (
            <CarouselArrow side="left" onClick={() => go(index - 1)} />
          )}
          {index < photos.length - 1 && (
            <CarouselArrow side="right" onClick={() => go(index + 1)} />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
            {photos.map((ph, i) => (
              <span key={ph.id} className={cn('h-1.5 rounded-full bg-white transition-all', i === index ? 'w-4 opacity-100' : 'w-1.5 opacity-55')} />
            ))}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function CarouselArrow({ side, onClick }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button onClick={onClick} aria-label={side === 'left' ? 'Foto anterior' : 'Próxima foto'}
      className={cn(
        'absolute top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-black/45 text-white transition hover:bg-black/65 pointer-coarse:hidden',
        side === 'left' ? 'left-3' : 'right-3',
      )}>
      <Icon size={20} strokeWidth={2.2} />
    </button>
  );
}

function MapEmbed({ place, className, eager = false }: { place: any; className?: string; eager?: boolean }) {
  return (
    <div className={cn('relative w-full overflow-hidden bg-cream', className)}>
      <iframe
        title={`Mapa: ${place.name}`}
        src={googleMapsEmbedUrl(place)}
        loading={eager ? 'eager' : 'lazy'}
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        className="mipas-gmap absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}

function ShareButton({ place }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const share = async () => {
    const url = placeShareUrl(place.id);
    try {
      const outcome = await shareOrCopy({ title: place.name, text: place.name, url });
      if (outcome !== 'copied') return;
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      prompt('Copie o link:', url);
    }
  };

  return (
    <Button onClick={share} variant="outline" size="sm" className="ml-auto shrink-0"
      icon={<Share size={13} strokeWidth={2.1} />}>
      {copied ? 'Link copiado' : 'Enviar'}
    </Button>
  );
}

function InstagramGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="4.4" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="17.3" cy="6.7" r="1.4" fill="currentColor" />
    </svg>
  );
}

function CardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando o lugar" className="overflow-hidden rounded-[22px] border border-line bg-surface">
      <div className="aspect-[4/5] w-full animate-pulse bg-cream" />
      <div className="flex flex-col gap-3 px-5 py-5">
        <div className="h-7 w-3/4 animate-pulse rounded-md bg-cream" />
        <div className="h-3.5 w-1/2 animate-pulse rounded bg-cream" />
        <div className="mt-2 h-11 w-full animate-pulse rounded-3xl bg-cream" />
      </div>
    </div>
  );
}

function Notice({ title, text, action = null }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-line bg-surface px-6 py-10 text-center">
      <div className="font-display text-[19px] font-normal text-ink">{title}</div>
      <div className="mx-auto mt-2 max-w-[320px] text-[13.5px] font-medium leading-relaxed text-sub [overflow-wrap:anywhere]">{text}</div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
