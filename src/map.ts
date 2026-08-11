import L from 'leaflet';

export function buildMarkerIcon(list: any) {
  const color = list ? list.color : '#FF5C38';
  const emoji = list ? list.emoji : '📍';
  return L.divIcon({
    className: '',
    iconSize: [36, 46],
    iconAnchor: [18, 44],
    html: `<div class="pin-anim" style="width:36px;height:46px;position:relative;filter:drop-shadow(0 3px 6px rgba(0,0,0,.45))">
        <svg width="36" height="46" viewBox="0 0 36 46" style="position:absolute;inset:0">
          <path d="M18 44L12 32H24L18 44Z" fill="${color}"/>
          <circle cx="18" cy="16" r="15" fill="${color}" stroke="#fff" stroke-width="2.5"/>
        </svg>
        <div style="position:absolute;top:2px;left:0;width:36px;text-align:center;font-size:15px;line-height:32px">${emoji}</div>
      </div>`,
  });
}

export function initMap(container: HTMLElement) {
  const map = L.map(container, { zoomControl: false, attributionControl: true });
  map.setView([-23.561, -46.656], 12);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(map);
  return map;
}

// Cores das duas rotas. Ficam aqui porque a legenda do card precisa usar
// exatamente as mesmas — são fixas de propósito: precisam se separar uma da
// outra e do mapa nos dois temas, coisa que as cores do tema não garantem.
export const ROUTE_COLORS = { walking: '#2FA37A', driving: '#4C8DF6' };

/** Azul de "você está aqui" — separado das rotas pra não confundir com o carro. */
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

/**
 * Ponto da posição atual, com o círculo da margem de erro em volta. Precisão
 * muito ruim (mais de 1 km) não vira círculo: só sujaria o mapa sem informar.
 */
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

/** Desenha carro (linha cheia) e a pé (tracejada) e enquadra o trajeto todo. */
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
  // Sem marcador quando a origem é o GPS: o ponto azul já está lá, desenhado
  // pelo syncMe, e dois pontos no mesmo lugar só confundem.
  if (origemTipo === 'home') L.marker(route.from, { icon: buildHomeIcon(), interactive: false }).addTo(grupo);
  grupo.addTo(map);
  layerRef.current = grupo;

  const limites = L.latLngBounds([...route.driving.coords, ...route.walking.coords, route.from, route.to]);
  // O card do lugar cobre a base do mapa; sem essa folga o trajeto some atrás dele.
  map.fitBounds(limites, { paddingTopLeft: [40, 90], paddingBottomRight: [40, cardHeight] });
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

/**
 * Desenha o roteiro inteiro na cor do modo escolhido e numera cada parada na
 * ordem em que o trajeto passa por elas. Trecho estimado sai tracejado, pra não
 * passar por caminho real o que é só linha reta.
 */
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

export function syncMarkers(
  map: L.Map,
  markersRef: { current: Record<string, L.Marker> },
  places: any[],
  lists: any[],
  onMarkerClick: (p: any) => void,
) {
  Object.values(markersRef.current).forEach(mk => mk.remove());
  markersRef.current = {};
  places.forEach(p => {
    const list = lists.find(l => (p.list_ids || []).includes(l.id));
    const marker = L.marker([p.latitude, p.longitude], { icon: buildMarkerIcon(list) }).addTo(map);
    marker.on('click', () => onMarkerClick(p));
    markersRef.current[p.id] = marker;
  });
}
