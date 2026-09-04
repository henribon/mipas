import L from 'leaflet';
import { haversineKm } from '@/geocoding';

export function coverPhoto(place: any) {
  const fotos = (place?.photos || []).filter((ph: any) => ph.url);
  if (fotos.length === 0) return null;
  return fotos.find((ph: any) => ph.id === place.cover_photo_id) || fotos[0];
}

export function buildMarkerIcon(list: any, animar = true) {
  const color = list ? list.color : '#FF5C38';
  return L.divIcon({
    className: '',
    iconSize: [32, 50],
    iconAnchor: [16, 49.5],
    html: `<div class="${animar ? 'pin-anim' : ''}" style="width:32px;height:50px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.45))">
        <svg width="32" height="50" viewBox="0 0 32 50">
          <path d="M.5 16.1A15.5 15.6 0 0 1 31.5 16.1C31.5 27.35 19 47.25 16 49.5C13 47.25 .5 27.35 .5 16.1Z" fill="${color}"/>
          <ellipse cx="16" cy="17" rx="7.3" ry="6.6" fill="#fff"/>
        </svg>
      </div>`,
  });
}

export function initMap(container: HTMLElement) {
  const map = L.map(container, { zoomControl: false, attributionControl: true });
  map.setView([-23.561, -46.656], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxNativeZoom: 19,
    maxZoom: 20,
  }).addTo(map);
  return map;
}

export const ROUTE_COLORS = { walking: '#2FA37A', driving: '#4C8DF6' };

export const ME_COLOR = '#2D7FF9';

function buildMeIcon() {
  return L.divIcon({
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<div style="width:18px;height:18px;border-radius:99px;background:${ME_COLOR};
        border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45)"></div>`,
  });
}

export function syncMe(
  map: L.Map,
  layerRef: { current: L.LayerGroup | null },
  pos: { latitude: number; longitude: number; accuracy: number } | null,
) {
  if (layerRef.current) {
    layerRef.current.remove();
    layerRef.current = null;
  }
  if (!pos) return;
  const grupo = L.layerGroup();
  if (pos.accuracy > 0 && pos.accuracy < 1000) {
    L.circle([pos.latitude, pos.longitude], {
      radius: pos.accuracy, color: ME_COLOR, weight: 1, opacity: .45,
      fillColor: ME_COLOR, fillOpacity: .12, interactive: false,
    }).addTo(grupo);
  }
  L.marker([pos.latitude, pos.longitude], { icon: buildMeIcon(), interactive: false, zIndexOffset: 800 }).addTo(grupo);
  grupo.addTo(map);
  layerRef.current = grupo;
}

function buildHomeIcon() {
  return L.divIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div style="width:30px;height:30px;border-radius:99px;background:#fff;border:2.5px solid ${ROUTE_COLORS.driving};
        display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 3px 8px rgba(0,0,0,.4)">🏠</div>`,
  });
}

export function clearRoute(layerRef: { current: L.LayerGroup | null }) {
  if (layerRef.current) {
    layerRef.current.remove();
    layerRef.current = null;
  }
}

export function drawRoute(
  map: L.Map,
  layerRef: { current: L.LayerGroup | null },
  route: { from: [number, number]; to: [number, number]; walking: { coords: [number, number][] }; driving: { coords: [number, number][] } },
  cardHeight = 240,
  origemTipo: 'gps' | 'home' = 'home',
) {
  clearRoute(layerRef);
  const grupo = L.layerGroup();
  L.polyline(route.driving.coords, {
    color: ROUTE_COLORS.driving, weight: 5, opacity: .85, lineJoin: 'round',
  }).addTo(grupo);
  L.polyline(route.walking.coords, {
    color: ROUTE_COLORS.walking, weight: 4, opacity: .95, dashArray: '1 9', lineCap: 'round',
  }).addTo(grupo);
  if (origemTipo === 'home') L.marker(route.from, { icon: buildHomeIcon(), interactive: false }).addTo(grupo);
  grupo.addTo(map);
  layerRef.current = grupo;

  const limites = L.latLngBounds([...route.driving.coords, ...route.walking.coords, route.from, route.to]);
  map.fitBounds(limites, { paddingTopLeft: [40, 90], paddingBottomRight: [40, cardHeight] });
}

export function semExtremos(places: any[]) {
  const validos = (places || []).filter(p => p && p.latitude != null && p.longitude != null);
  if (validos.length < 3) return validos;
  const mediana = (nums: number[]) => {
    const ord = [...nums].sort((a, b) => a - b);
    return ord[Math.floor(ord.length / 2)];
  };
  const centroLat = mediana(validos.map(p => p.latitude));
  const centroLng = mediana(validos.map(p => p.longitude));
  const distancia = (p: any) => haversineKm(centroLat, centroLng, p.latitude, p.longitude);
  const limite = Math.max(500, mediana(validos.map(distancia)) * 5);
  const doMiolo = validos.filter(p => distancia(p) <= limite);
  return doMiolo.length ? doMiolo : validos;
}

export function fitPlaces(map: L.Map, places: any[], cardHeight = 60, zoomMaximo = 16) {
  const pontos = (places || [])
    .filter(p => p && p.latitude != null && p.longitude != null)
    .map(p => [p.latitude, p.longitude] as [number, number]);
  if (pontos.length === 0) return;
  const tamanho = map.getSize();
  if (!tamanho.x || !tamanho.y) {
    map.once('resize', () => fitPlaces(map, places, cardHeight, zoomMaximo));
    return;
  }
  if (pontos.length === 1) {
    map.flyTo(pontos[0], Math.max(map.getZoom(), 15), { duration: .7 });
    return;
  }
  map.flyToBounds(L.latLngBounds(pontos), {
    paddingTopLeft: [50, 90],
    paddingBottomRight: [50, cardHeight],
    maxZoom: 16,
    duration: .7,
  });
}

function buildStopIcon(numero: number, color: string) {
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;border-radius:99px;background:${color};color:#fff;border:2.5px solid #fff;
        display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;font-size:13px;font-weight:800;
        box-shadow:0 3px 8px rgba(0,0,0,.4)">${numero}</div>`,
  });
}

export function drawItinerary(
  map: L.Map,
  layerRef: { current: L.LayerGroup | null },
  itinerary: { mode: 'walking' | 'driving'; points: [number, number][]; legs: { coords: [number, number][]; estimated: boolean }[] },
  cardHeight = 240,
) {
  clearRoute(layerRef);
  const cor = ROUTE_COLORS[itinerary.mode];
  const grupo = L.layerGroup();
  itinerary.legs.forEach(leg => {
    L.polyline(leg.coords, {
      color: cor,
      weight: 5,
      opacity: .85,
      lineJoin: 'round',
      ...(leg.estimated ? { dashArray: '2 10', lineCap: 'round' as const } : null),
    }).addTo(grupo);
  });
  itinerary.points.forEach((p, i) => {
    L.marker(p, { icon: buildStopIcon(i + 1, cor), interactive: false, zIndexOffset: 600 }).addTo(grupo);
  });
  grupo.addTo(map);
  layerRef.current = grupo;

  const todos = [...itinerary.legs.flatMap(l => l.coords), ...itinerary.points];
  if (todos.length === 0) return;
  map.fitBounds(L.latLngBounds(todos), { paddingTopLeft: [40, 90], paddingBottomRight: [40, cardHeight] });
}


const LADO_DA_CABECA = 31;

const COBERTURA_MAXIMA = .5;

function cobertura(a: L.Point, b: L.Point) {
  const largura = Math.max(0, LADO_DA_CABECA - Math.abs(a.x - b.x));
  const altura = Math.max(0, LADO_DA_CABECA - Math.abs(a.y - b.y));
  return (largura * altura) / (LADO_DA_CABECA * LADO_DA_CABECA);
}

const seEmpilham = (a: L.Point, b: L.Point) => cobertura(a, b) > COBERTURA_MAXIMA;

type Grupo = { places: any[]; lat: number; lng: number };

function agrupar(map: L.Map, places: any[]): Grupo[] {
  const pontos = places.map(p => ({ p, xy: map.latLngToLayerPoint([p.latitude, p.longitude]) }));
  const usados = new Array(pontos.length).fill(false);
  const grupos: Grupo[] = [];
  pontos.forEach((a, i) => {
    if (usados[i]) return;
    usados[i] = true;
    const juntos = [a.p];
    pontos.forEach((b, j) => {
      if (usados[j] || j === i) return;
      if (!seEmpilham(a.xy, b.xy)) return;
      usados[j] = true;
      juntos.push(b.p);
    });
    grupos.push(comCentro(juntos));
  });
  return fundirProximos(map, grupos);
}

const comCentro = (places: any[]): Grupo => ({
  places,
  lat: places.reduce((s, p) => s + p.latitude, 0) / places.length,
  lng: places.reduce((s, p) => s + p.longitude, 0) / places.length,
});

function fundirProximos(map: L.Map, grupos: Grupo[]): Grupo[] {
  const atuais = [...grupos];
  for (let volta = 0; volta < 10; volta++) {
    const pontos = atuais.map(g => map.latLngToLayerPoint([g.lat, g.lng]));
    let fundiu = false;
    for (let i = 0; i < atuais.length && !fundiu; i++) {
      for (let j = i + 1; j < atuais.length; j++) {
        if (!seEmpilham(pontos[i], pontos[j])) continue;
        atuais[i] = comCentro([...atuais[i].places, ...atuais[j].places]);
        atuais.splice(j, 1);
        fundiu = true;
        break;
      }
    }
    if (!fundiu) break;
  }
  return atuais;
}

function buildClusterIcon(color: string, quantidade: number, animar: boolean) {
  const lado = quantidade > 9 ? 42 : 36;
  return L.divIcon({
    className: '',
    iconSize: [lado, lado],
    iconAnchor: [lado / 2, lado / 2],
    html: `<div class="${animar ? 'pin-anim' : ''}" title="${quantidade} lugares aqui — clique pra separar"
        style="width:${lado}px;height:${lado}px;border-radius:99px;background:${color};border:2.5px solid #fff;
        box-shadow:0 3px 8px rgba(0,0,0,.4);color:#fff;font-family:Inter,sans-serif;
        font-size:${quantidade > 9 ? 14 : 15}px;font-weight:800;cursor:pointer;
        display:flex;align-items:center;justify-content:center">${quantidade}</div>`,
  });
}

type EstadoMarcadores = {
  map: L.Map;
  markersRef: { current: Record<string, L.Marker> };
  places: any[];
  lists: any[];
  onMarkerClick: (p: any) => void;
};

let ultimoEstado: EstadoMarcadores | null = null;
let mapaOuvindoZoom: L.Map | null = null;

export function syncMarkers(
  map: L.Map,
  markersRef: { current: Record<string, L.Marker> },
  places: any[],
  lists: any[],
  onMarkerClick: (p: any) => void,
) {
  ultimoEstado = { map, markersRef, places, lists, onMarkerClick };
  if (mapaOuvindoZoom !== map) {
    mapaOuvindoZoom = map;
    map.on('zoomend', () => { if (ultimoEstado) desenharMarcadores(ultimoEstado, false); });
  }
  desenharMarcadores(ultimoEstado, true);
}

function desenharMarcadores(estado: EstadoMarcadores, animar: boolean) {
  const { map, markersRef, places, lists, onMarkerClick } = estado;
  Object.values(markersRef.current).forEach(mk => mk.remove());
  markersRef.current = {};
  const validos = (places || []).filter(p => p && p.latitude != null && p.longitude != null);
  agrupar(map, validos).forEach((grupo, i) => {
    const primeiro = grupo.places[0];
    const list = lists.find(l => (primeiro.list_ids || []).includes(l.id));

    if (grupo.places.length > 1) {
      const marker = L.marker([grupo.lat, grupo.lng], {
        icon: buildClusterIcon(list ? list.color : '#FF5C38', grupo.places.length, animar),
      }).addTo(map);
      marker.on('click', () => fitPlaces(map, grupo.places, 60, 18));
      markersRef.current['grupo:' + i] = marker;
      return;
    }

    const marker = L.marker([primeiro.latitude, primeiro.longitude], {
      icon: buildMarkerIcon(list, animar),
    }).addTo(map);
    marker.on('click', () => onMarkerClick(primeiro));
    markersRef.current[primeiro.id] = marker;
  });
}
