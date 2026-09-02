import { haversineKm } from '@/geocoding';

export type Ponto = [number, number];

export type RouteLeg = {
  km: number;
  minutes: number;
  coords: Ponto[];
  estimated: boolean;
};

export type Routes = { from: Ponto; to: Ponto; walking: RouteLeg; driving: RouteLeg };

const VALHALLA = 'https://valhalla1.openstreetmap.de/route';
const VALHALLA_OTIMIZADO = 'https://valhalla1.openstreetmap.de/optimized_route';
const TIMEOUT_MS = 12000;

const COSTING = { walking: 'pedestrian', driving: 'auto' };

export type Modo = keyof typeof COSTING;

export const MAX_PARADAS = 10;

const DETOUR = 1.3;
const KMH = { walking: 4.8, driving: 28 };

const cache = new Map<string, RouteLeg>();

const chave = (modo: string, from: Ponto, to: Ponto) =>
  `${modo}:${from.map(n => n.toFixed(5)).join()}>${to.map(n => n.toFixed(5)).join()}`;

export function decodePolyline(str: string, precision = 6): Ponto[] {
  const fator = Math.pow(10, precision);
  const out: Ponto[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  while (i < str.length) {
    let resultado = 1;
    let deslocamento = 0;
    let b: number;
    do {
      b = str.charCodeAt(i++) - 63 - 1;
      resultado += b << deslocamento;
      deslocamento += 5;
    } while (b >= 0x1f);
    lat += resultado & 1 ? ~(resultado >> 1) : resultado >> 1;

    resultado = 1;
    deslocamento = 0;
    do {
      b = str.charCodeAt(i++) - 63 - 1;
      resultado += b << deslocamento;
      deslocamento += 5;
    } while (b >= 0x1f);
    lng += resultado & 1 ? ~(resultado >> 1) : resultado >> 1;

    out.push([lat / fator, lng / fator]);
  }
  return out;
}

function estimativa(modo: keyof typeof KMH, from: Ponto, to: Ponto): RouteLeg {
  const km = haversineKm(from[0], from[1], to[0], to[1]) * DETOUR;
  return { km, minutes: (km / KMH[modo]) * 60, coords: [from, to], estimated: true };
}

async function fetchLeg(modo: keyof typeof COSTING, from: Ponto, to: Ponto): Promise<RouteLeg> {
  const emCache = cache.get(chave(modo, from, to));
  if (emCache) return emCache;

  const json = JSON.stringify({
    locations: [{ lat: from[0], lon: from[1] }, { lat: to[0], lon: to[1] }],
    costing: COSTING[modo],
    directions_options: { units: 'kilometers' },
  });
  const controle = new AbortController();
  const prazo = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${VALHALLA}?json=${encodeURIComponent(json)}`, { signal: controle.signal });
    if (!res.ok) throw new Error(`Valhalla respondeu ${res.status}`);
    const dados = await res.json();
    const trip = dados && dados.trip;
    const leg = trip && trip.legs && trip.legs[0];
    if (!leg || !leg.shape) throw new Error('rota sem geometria');
    const rota: RouteLeg = {
      km: trip.summary.length,
      minutes: trip.summary.time / 60,
      coords: decodePolyline(leg.shape),
      estimated: false,
    };
    cache.set(chave(modo, from, to), rota);
    return rota;
  } finally {
    clearTimeout(prazo);
  }
}

export async function fetchRoutes(from: Ponto, to: Ponto): Promise<Routes> {
  const [walking, driving] = await Promise.all(
    (['walking', 'driving'] as const).map(modo =>
      fetchLeg(modo, from, to).catch(e => {
        console.warn(`[Mipas] rota ${modo} veio por estimativa:`, e);
        return estimativa(modo, from, to);
      })),
  );
  return { from, to, walking, driving };
}

export type Itinerary = {
  mode: Modo;
  points: Ponto[];
  order: number[];
  legs: RouteLeg[];
  km: number;
  minutes: number;
  estimated: boolean;
};

const cacheRoteiro = new Map<string, Itinerary>();

const chaveRoteiro = (modo: string, pontos: Ponto[], otimizar: boolean) =>
  `${modo}:${otimizar ? 'opt' : 'fixo'}:`
  + pontos.map(p => p.map(n => n.toFixed(5)).join()).join('>');

async function pedeTrip(url: string, pontos: Ponto[], modo: Modo) {
  const json = JSON.stringify({
    locations: pontos.map(([lat, lon]) => ({ lat, lon })),
    costing: COSTING[modo],
    directions_options: { units: 'kilometers' },
  });
  const controle = new AbortController();
  const prazo = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url}?json=${encodeURIComponent(json)}`, { signal: controle.signal });
    if (!res.ok) throw new Error(`Valhalla respondeu ${res.status}`);
    const dados = await res.json();
    const trip = dados && dados.trip;
    if (!trip || !Array.isArray(trip.legs) || trip.legs.length !== pontos.length - 1) {
      throw new Error('roteiro veio sem os trechos esperados');
    }
    return trip;
  } finally {
    clearTimeout(prazo);
  }
}

function legsDoTrip(trip: any): RouteLeg[] {
  return trip.legs.map((l: any) => {
    if (!l || !l.shape || !l.summary) throw new Error('trecho sem geometria');
    return {
      km: l.summary.length,
      minutes: l.summary.time / 60,
      coords: decodePolyline(l.shape),
      estimated: false,
    };
  });
}

function ordemDoTrip(trip: any, total: number): number[] | null {
  const locais = trip.locations;
  if (!Array.isArray(locais) || locais.length !== total) return null;
  const ordem = locais.map((l: any, i: number) => (l && l.original_index != null ? l.original_index : i));
  const valida = ordem.every((i: number) => Number.isInteger(i) && i >= 0 && i < total)
    && new Set(ordem).size === total;
  return valida ? ordem : null;
}

export async function fetchItinerary(pontos: Ponto[], modo: Modo, otimizar: boolean): Promise<Itinerary> {
  const chave = chaveRoteiro(modo, pontos, otimizar);
  const emCache = cacheRoteiro.get(chave);
  if (emCache) return emCache;

  let ordem = pontos.map((_, i) => i);
  let legs: RouteLeg[] | null = null;

  if (otimizar) {
    try {
      const trip = await pedeTrip(VALHALLA_OTIMIZADO, pontos, modo);
      legs = legsDoTrip(trip);
      ordem = ordemDoTrip(trip, pontos.length) || ordem;
    } catch (e) {
      console.warn('[Mipas] não deu pra otimizar a ordem do roteiro:', e);
    }
  }

  if (!legs) {
    try {
      const trip = await pedeTrip(VALHALLA, pontos, modo);
      legs = legsDoTrip(trip);
      ordem = pontos.map((_, i) => i);
    } catch (e) {
      console.warn('[Mipas] roteiro veio por estimativa:', e);
    }
  }

  const finais = ordem.map(i => pontos[i]);
  if (!legs) legs = finais.slice(1).map((p, i) => estimativa(modo, finais[i], p));

  const roteiro: Itinerary = {
    mode: modo,
    points: finais,
    order: ordem,
    legs,
    km: legs.reduce((soma, l) => soma + l.km, 0),
    minutes: legs.reduce((soma, l) => soma + l.minutes, 0),
    estimated: legs.some(l => l.estimated),
  };
  cacheRoteiro.set(chave, roteiro);
  return roteiro;
}

export function formatKm(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export function formatMinutes(minutes: number) {
  const total = Math.max(1, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}
