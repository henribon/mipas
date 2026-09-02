import L from 'leaflet';
import { haversineKm } from '@/geocoding';

/**
 * A foto que representa o lugar: a escolhida a dedo, quando existe, e senão a
 * primeira da galeria. O pin do mapa não usa foto nenhuma — quem ainda pede a
 * capa por aqui é o card do lugar e a linha da lista.
 */
export function coverPhoto(place: any) {
  const fotos = (place?.photos || []).filter((ph: any) => ph.url);
  if (fotos.length === 0) return null;
  return fotos.find((ph: any) => ph.id === place.cover_photo_id) || fotos[0];
}

/**
 * O pin: a gota na cor da lista, com o furo branco no meio e nada dentro dele.
 * Sem foto e sem emoji — é a cor que diz de qual lista o lugar é, e a silhueta
 * limpa continua legível pequena, no zoom em que o mapa mostra a cidade
 * inteira, coisa que a miniatura de 38px nunca conseguiu.
 *
 * A silhueta é calcada no desenho que o dono mandou: cúpula quase redonda em
 * cima e laterais que descem cheias, afinando só perto da ponta. Repare que
 * elas são curvas, não retas — reta do ombro até a ponta dá um pin triangular,
 * magro no meio, que é bem menos parecido com o desenho. As curvas foram
 * ajustadas contra a largura medida do original em nove alturas.
 *
 * O furo é elipse (um pouco mais largo que alto) e fica levemente abaixo do
 * centro da cúpula, como no desenho.
 */
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

/**
 * A cabeça do pin: a cúpula de 31px no topo da gota. O bico de baixo não entra
 * na conta — é fino, aponta pro chão e não é ele que alguém procura na tela.
 */
const LADO_DA_CABECA = 31;

/**
 * Quanto um pin pode esconder do outro antes de valer mais a pena mostrar uma
 * bolha com a contagem. Encostar não atrapalha: dois pins com um pedaço
 * coberto continuam legíveis, clicáveis e — diferente da bolha — dizem onde
 * cada lugar fica. Só passa a atrapalhar quando um engole mais da metade do
 * outro.
 */
const COBERTURA_MAXIMA = .5;

/**
 * Fração de um pin que o outro cobre na tela: a área comum entre as duas
 * cabeças. O critério já foi a distância entre os centros, com um raio maior
 * que o próprio pin — dois pins que mal se tocavam viravam bolha, e era isso
 * que empilhava lugares a 400m de distância num zoom onde dá pra ler o nome
 * das ruas.
 */
function cobertura(a: L.Point, b: L.Point) {
  const largura = Math.max(0, LADO_DA_CABECA - Math.abs(a.x - b.x));
  const altura = Math.max(0, LADO_DA_CABECA - Math.abs(a.y - b.y));
  return (largura * altura) / (LADO_DA_CABECA * LADO_DA_CABECA);
}

const seEmpilham = (a: L.Point, b: L.Point) => cobertura(a, b) > COBERTURA_MAXIMA;

type Grupo = { places: any[]; lat: number; lng: number };

/**
 * Agrupa pelo que se vê na tela, não por coordenada: o que importa é o quanto
 * os pins se cobrem no zoom atual. Guloso e O(n²) — com dezenas de lugares
 * isso é instantâneo, e evita a costura torta que uma grade fixa deixaria
 * quando dois pontos vizinhos caem em células diferentes.
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

/**
 * O centro de um grupo não fica onde estava a semente dele, então dois grupos
 * recém-formados podem terminar cobrindo um ao outro — exatamente a pilha que
 * o agrupamento existe pra evitar. Esta passada funde os que ficaram por cima
 * um do outro, até ninguém mais se cobrir.
 *
 * O centro andar a cada fusão já foi motivo de grupo crescer em cadeia muito
 * além do que a bolha representa; com a cobertura no lugar do raio isso parou
 * de acontecer, porque o critério só alcança quem está de fato empilhado.
 */
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

    const marker = L.marker([primeiro.latitude, primeiro.longitude], {
      icon: buildMarkerIcon(list, animar),
    }).addTo(map);
    marker.on('click', () => onMarkerClick(primeiro));
    markersRef.current[primeiro.id] = marker;
  });
}
