export type GeocodeResult = { address: string; lat: number; lng: number };

export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=5&q=' +
    encodeURIComponent(query);
  const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
  if (!res.ok) throw new Error('Falha ao buscar endereço');
  const results = await res.json();
  return results.map((r: any) => ({
    address: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }));
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function debounced(this: unknown, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function shortAddress(full: string) {
  const parts = String(full)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (parts.length < 2) return full;
  if (/^\d+[a-zA-Z]?$/.test(parts[0])) {
    return parts[1] + ', ' + parts[0] + (parts[2] ? ' – ' + parts[2] : '');
  }
  return parts[0] + ' – ' + parts[1];
}
