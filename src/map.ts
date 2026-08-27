import L from 'leaflet';
import { haversineKm } from '@/geocoding';

/**
 * A foto que representa o lugar no mapa: a escolhida a dedo, quando existe, e
 * senão a primeira da galeria — assim todo lugar com foto já nasce com preview
 * no pin, sem ninguém precisar escolher nada.
 */
export function coverPhoto(place: any) {
  const fotos = (place?.photos || []).filter((ph: any) => ph.url);
  if (fotos.length === 0) return null;
  return fotos.find((ph: any) => ph.id === place.cover_photo_id) || fotos[0];
}

// A URL entra dentro de um atributo HTML; aspas soltas ali quebrariam o markup.
const emAttr = (url: string) => String(url).replace(/'/g, '%27').replace(/"/g, '%22');

// O Leaflet põe z-index 200 em todo <svg> dentro do mapa, então quem vem
// depois do desenho do pin precisa de z-index maior pra não ser pintado por
// baixo do círculo — foi o que escondia a foto (e o emoji) dentro do marcador.
const ACIMA_DO_SVG = 'z-index:201';

export function buildMarkerIcon(list: any, coverUrl?: string | null, animar = true) {
  const color = list ? list.color : '#FF5C38';
  const emoji = list ? list.emoji : '📍';
  const anim = animar ? 'pin-anim' : '';
  if (!coverUrl) {
    return L.divIcon({
      className: '',
      iconSize: [36, 46],
      iconAnchor: [18, 44],
      html: `<div class="${anim}" style="width:36px;height:46px;position:relative;filter:drop-shadow(0 3px 6px rgba(0,0,0,.45))">
        <svg width="36" height="46" viewBox="0 0 36 46" style="position:absolute;inset:0">
          <path d="M18 44L12 32H24L18 44Z" fill="${color}"/>
          <circle cx="18" cy="16" r="15" fill="${color}" stroke="#fff" stroke-width="2.5"/>
        </svg>
        <div style="position:absolute;top:2px;left:0;width:36px;text-align:center;font-size:15px;line-height:32px;${ACIMA_DO_SVG}">${emoji}</div>
      </div>`,
    });
  }
  // Pin com foto é quadrado e maior de propósito: foto é retângulo, e o
  // recorte redondo comia justamente as bordas que dizem que lugar é aquele.
  // A cor da lista vira a moldura, e o emoji fica atrás da foto pra reaparecer
  // sozinho se a imagem sumir.
  return L.divIcon({
    className: '',
    iconSize: [48, 60],
    iconAnchor: [24, 58],
    html: `<div class="pin-foto ${anim}" style="width:48px;height:60px;position:relative;filter:drop-shadow(0 3px 6px rgba(0,0,0,.45))">
        <svg width="48" height="60" viewBox="0 0 48 60" style="position:absolute;inset:0">
          <path d="M24 58L17 43H31L24 58Z" fill="${color}"/>
          <rect x="1" y="1" width="46" height="46" rx="12" fill="${color}" stroke="#fff" stroke-width="2"/>
        </svg>
        <div style="position:absolute;top:5px;left:5px;width:38px;height:38px;text-align:center;font-size:17px;line-height:38px;${ACIMA_DO_SVG}">${emoji}</div>
        <img src="${emAttr(coverUrl)}" alt="" draggable="false" onerror="this.remove()"
          style="position:absolute;top:5px;left:5px;width:38px;height:38px;border-radius:8px;object-fit:cover;z-index:202"/>
      </div>`,
  });
}

// Miniatura pronta por foto (id da foto -> data URI). A URL assinada troca a
// cada carregamento da página, mas o id da foto não — é ele que serve de chave.
const miniaturas = new Map<string, string>();
// 38px no pin em repouso, mas até ~84px quando o mouse amplia — 200px cobre
// os dois com folga em tela 2x, e ainda pesa uns 15 KB no lugar dos 12 MP.
const LADO_MINIATURA = 200;

/**
 * As fotos saem da câmera com 12 MP e o pin exibe 38 pixels delas. Jogar a
 * imagem inteira dentro de um layer minúsculo, arredondado e com drop-shadow é
 * pedir pro navegador rasterizar 12 milhões de pixels pra mostrar mil — e o
 * Chromium às vezes simplesmente desiste, deixando o círculo vazio sem dar
 * erro nenhum. Então o mapa desenha a sua própria miniatura, uma vez por foto,
 * e usa esse recorte quadrado no lugar da foto original.
 */
function gerarMiniatura(id: string, url: string): Promise<string | null> {
  const pronta = miniaturas.get(id);
  if (pronta) return Promise.resolve(pronta);
  return new Promise(resolve => {
    const img = new Image();
    // Sem isto o canvas fica "sujo" e o toDataURL é bloqueado.
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = LADO_MINIATURA;
        canvas.height = LADO_MINIATURA;
        const ctx = canvas.getContext('2d');
        const lado = Math.min(img.naturalWidth, img.naturalHeight);
        ctx.drawImage(
          img,
          (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado,
          0, 0, LADO_MINIATURA, LADO_MINIATURA,
        );
        const mini = canvas.toDataURL('image/jpeg', .82);
        miniaturas.set(id, mini);
        resolve(mini);
      } catch (e) {
        // Canvas bloqueado por CORS: melhor a foto inteira que pin sem foto.
        resolve(url);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function initMap(container: HTMLElement) {
  const map = L.map(container, { zoomControl: false, attributionControl: true });
  map.setView([-23.561, -46.656], 12);
  // O CARTO (Positron) passou a exigir chave de API e carimbou "API KEY
  // REQUIRED" por cima do mapa. Estes tiles são do próprio OpenStreetMap:
  // sem chave, sem cadastro e sem carimbo. Eles são mais coloridos que o
  // Positron, então quem devolve o tom apagado do Mipas é o filtro CSS de
  // .leaflet-tile-pane no index.css.
  //
  // maxNativeZoom: o OSM só serve tile até o zoom 19; acima disso o Leaflet
  // estica o último tile em vez de pedir uma imagem que não existe.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxNativeZoom: 19,
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

/**
 * Põe a câmera em volta de um conjunto de lugares: acha o retângulo que
 * contém todos e abre o zoom até caber. Um lugar só não tem retângulo — aí é
 * só ir até ele, sem colar a câmera no chão.
 *
 * `maxZoom` existe pro caso de dois bares na mesma esquina: sem ele o
 * enquadramento cairia no zoom máximo e o mapa viraria uma calçada.
 */
/**
 * Descarta lugares absurdamente longe do miolo antes de enquadrar. Um lugar
 * de teste em outro continente (ou uma viagem antiga) faria o zoom abrir tanto
 * que a cidade inteira viraria um ponto só — e o enquadramento inicial deixaria
 * de dizer qualquer coisa. O limite é generoso de propósito: 500 km cobre o
 * estado e os vizinhos, então SP e Rio continuam cabendo juntos.
 */
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
  // Se a regra derrubar todo mundo (não deveria), é melhor enquadrar tudo do
  // que não enquadrar nada.
  return doMiolo.length ? doMiolo : validos;
}

export function fitPlaces(map: L.Map, places: any[], cardHeight = 60, zoomMaximo = 16) {
  const pontos = (places || [])
    .filter(p => p && p.latitude != null && p.longitude != null)
    .map(p => [p.latitude, p.longitude] as [number, number]);
  if (pontos.length === 0) return;
  // Enquadrar antes do mapa ter tamanho na tela dá divisão por zero no cálculo
  // do zoom: sai NaN e o Leaflet derruba a aplicação inteira. No primeiro
  // instante o container ainda não foi medido, então esperamos ele aparecer —
  // o invalidateSize que o app já dispara na abertura emite esse "resize".
  const tamanho = map.getSize();
  if (!tamanho.x || !tamanho.y) {
    map.once('resize', () => fitPlaces(map, places, cardHeight, zoomMaximo));
    return;
  }
  if (pontos.length === 1) {
    map.flyTo(pontos[0], Math.max(map.getZoom(), 15), { duration: .7 });
    return;
  }
  // A folga de cima é a barra de busca e os botões flutuantes; a de baixo, o
  // card do lugar quando está aberto.
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

// ---------------------------------------------------------
// Agrupamento de pins
// Dois lugares na mesma quadra viram dois pins colados e o de trás fica
// impossível de clicar. Em vez de deixar a pilha, os que se encostam viram um
// marcador só com a contagem; clicar nele aproxima até eles se separarem.
// ---------------------------------------------------------

/** Distância em pixels abaixo da qual dois pins se atrapalham na tela. */
const RAIO_AGRUPAMENTO = 46;

type Grupo = { places: any[]; lat: number; lng: number };

/**
 * Agrupa por distância na tela, não por coordenada: o que importa é se os pins
 * se encostam no zoom atual. Guloso e O(n²) — com dezenas de lugares isso é
 * instantâneo, e evita a costura torta que uma grade fixa deixaria quando dois
 * pontos vizinhos caem em células diferentes.
 */
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
      if (a.xy.distanceTo(b.xy) > RAIO_AGRUPAMENTO) return;
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

/**
 * O centro de um grupo não fica onde estava a semente dele, então dois grupos
 * recém-formados podem terminar mais perto um do outro do que o raio permite —
 * exatamente a sobreposição que o agrupamento existe pra evitar. Esta passada
 * funde os que ficaram colados, até ninguém mais se encostar.
 */
function fundirProximos(map: L.Map, grupos: Grupo[]): Grupo[] {
  const atuais = [...grupos];
  for (let volta = 0; volta < 10; volta++) {
    const pontos = atuais.map(g => map.latLngToLayerPoint([g.lat, g.lng]));
    let fundiu = false;
    for (let i = 0; i < atuais.length && !fundiu; i++) {
      for (let j = i + 1; j < atuais.length; j++) {
        if (pontos[i].distanceTo(pontos[j]) > RAIO_AGRUPAMENTO) continue;
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

// Mudar o zoom muda quais pins se encostam, então o agrupamento é refeito a
// cada zoom com os últimos dados recebidos.
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
    // Reagrupar não é dado novo: sem a animação de queda, senão o mapa inteiro
    // pularia a cada zoom.
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
      // Zoom mais fundo que o de lista: aqui o objetivo é justamente descolar
      // pins que estão a poucos metros um do outro.
      marker.on('click', () => fitPlaces(map, grupo.places, 60, 18));
      markersRef.current['grupo:' + i] = marker;
      return;
    }

    const capa = coverPhoto(primeiro);
    const mini = capa ? miniaturas.get(capa.id) : null;
    const marker = L.marker([primeiro.latitude, primeiro.longitude], {
      icon: buildMarkerIcon(list, mini, animar),
    }).addTo(map);
    marker.on('click', () => onMarkerClick(primeiro));
    markersRef.current[primeiro.id] = marker;
    // Sem miniatura pronta o pin nasce com o emoji e ganha a foto quando ela
    // fica pronta — nunca fica esperando download pra aparecer no mapa.
    if (capa && !mini) {
      gerarMiniatura(capa.id, capa.url).then(nova => {
        if (nova && markersRef.current[primeiro.id] === marker) marker.setIcon(buildMarkerIcon(list, nova, false));
      });
    }
  });
}
