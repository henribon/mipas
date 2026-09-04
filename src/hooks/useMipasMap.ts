import { useEffect, useRef, useState } from 'react';
import * as mapa from '@/map';
import { fetchRoutes, fetchItinerary } from '@/routing';

type OpcoesDeVoo = {
  zoom?: number;
  zoomMinimo?: number;
  duracao?: number;
  atraso?: number;
  remedir?: boolean;
};

export function useMipasMap({
  places, visiblePlaces, lists, isDesktop, sharedMode,
  openListId, selId, setSelId, gpsPos, routePlaceId, origemRota,
  itineraryOpen, stopIds, itineraryMode, optimize, fromOrigin,
  onEscolherParada, onAbrirLugar, onCliqueNoMapa, fail,
}) {
  const mapRef = useRef(null);
  const leafRef = useRef(null);
  const markersRef = useRef({});
  const routeLayerRef = useRef(null);
  const itineraryLayerRef = useRef(null);
  const meLayerRef = useRef(null);

  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [itinerary, setItinerary] = useState(null);
  const [itineraryLoading, setItineraryLoading] = useState(false);

  const invalidarTamanho = (ms = 60) => setTimeout(
    () => leafRef.current && leafRef.current.invalidateSize(), ms,
  );

  const voarPara = (lat, lng, opcoes: OpcoesDeVoo = {}) => {
    const { zoom, zoomMinimo, duracao = .8, atraso = 0, remedir = false } = opcoes;
    setTimeout(() => {
      const m = leafRef.current;
      if (!m) return;
      if (remedir) m.invalidateSize();
      const alvo = zoomMinimo != null ? Math.max(m.getZoom(), zoomMinimo) : zoom;
      m.flyTo([lat, lng], alvo, { duration: duracao });
    }, atraso);
  };

  useEffect(() => {
    const m = mapa.initMap(mapRef.current);
    leafRef.current = m;
    m.on('click', onCliqueNoMapa);
    setTimeout(() => m.invalidateSize(), 300);
    return () => { m.remove(); };
  }, []);

  useEffect(() => {
    if (leafRef.current) setTimeout(() => leafRef.current.invalidateSize(), 250);
  }, [isDesktop]);

  useEffect(() => {
    const m = leafRef.current;
    if (!m) return;
    mapa.syncMarkers(m, markersRef, visiblePlaces, lists, (p) => {
      if (itineraryOpen) { onEscolherParada(p); return; }
      onAbrirLugar(p);
      m.flyTo([p.latitude, p.longitude], Math.max(m.getZoom(), 14), { duration: .6 });
    });
  }, [visiblePlaces, lists, itineraryOpen]);

  const enquadrouAoAbrir = useRef(false);
  useEffect(() => {
    const m = leafRef.current;
    if (!m || enquadrouAoAbrir.current) return;
    if (openListId) return;
    const doMiolo = mapa.semExtremos(visiblePlaces);
    if (doMiolo.length === 0) return;
    enquadrouAoAbrir.current = true;
    mapa.fitPlaces(m, doMiolo);
  }, [visiblePlaces, openListId]);

  const listaEnquadrada = useRef(null);
  useEffect(() => {
    const m = leafRef.current;
    if (!m || !isDesktop || !openListId) {
      listaEnquadrada.current = null;
      return;
    }
    if (listaEnquadrada.current === openListId) return;
    const daLista = visiblePlaces.filter(p => (p.list_ids || []).includes(openListId));
    if (daLista.length === 0) return;
    listaEnquadrada.current = openListId;
    mapa.fitPlaces(m, daLista, selId ? 240 : 60);
  }, [openListId, isDesktop, visiblePlaces]);

  useEffect(() => {
    if (selId && !visiblePlaces.some(p => p.id === selId)) setSelId(null);
  }, [visiblePlaces, selId]);

  useEffect(() => {
    if (!sharedMode || places.length === 0) return;
    const m = leafRef.current;
    if (!m) return;
    const first = places[0];
    setTimeout(() => m.flyTo([first.latitude, first.longitude], 13, { duration: .6 }), 200);
  }, [sharedMode, places]);

  useEffect(() => {
    const m = leafRef.current;
    if (!m) return;
    mapa.clearRoute(routeLayerRef);
    setRoute(null);
    const place = places.find(p => p.id === routePlaceId);
    if (!place || !origemRota) return;
    let cancelado = false;
    setRouteLoading(true);
    fetchRoutes([origemRota.latitude, origemRota.longitude], [place.latitude, place.longitude])
      .then(r => {
        if (cancelado || !leafRef.current) return;
        setRoute(r);
        mapa.drawRoute(leafRef.current, routeLayerRef, r, 240, origemRota.tipo);
      })
      .catch(e => { if (!cancelado) fail('Não deu pra traçar o caminho até esse lugar', e); })
      .finally(() => { if (!cancelado) setRouteLoading(false); });
    return () => { cancelado = true; };
  }, [routePlaceId, origemRota]);

  useEffect(() => {
    if (leafRef.current) mapa.syncMe(leafRef.current, meLayerRef, gpsPos);
  }, [gpsPos]);

  useEffect(() => {
    const m = leafRef.current;
    if (!m) return;
    mapa.clearRoute(itineraryLayerRef);
    setItinerary(null);
    if (!itineraryOpen) return;

    const paradas = stopIds.map(id => places.find(p => p.id === id)).filter(Boolean);
    const pontos: [number, number][] = [
      ...(fromOrigin && origemRota ? [[origemRota.latitude, origemRota.longitude] as [number, number]] : []),
      ...paradas.map(p => [p.latitude, p.longitude] as [number, number]),
    ];
    if (pontos.length < 2) { setItineraryLoading(false); return; }

    let cancelado = false;
    setItineraryLoading(true);
    const espera = setTimeout(() => {
      fetchItinerary(pontos, itineraryMode, optimize)
        .then(r => {
          if (cancelado || !leafRef.current) return;
          setItinerary(r);
          mapa.drawItinerary(leafRef.current, itineraryLayerRef, r, isDesktop ? 40 : 300);
        })
        .catch(e => { if (!cancelado) fail('Não deu pra montar o roteiro', e); })
        .finally(() => { if (!cancelado) setItineraryLoading(false); });
    }, 700);

    return () => { cancelado = true; clearTimeout(espera); };
  }, [itineraryOpen, stopIds, itineraryMode, optimize, fromOrigin, origemRota, places]);

  return {
    mapRef, leafRef,
    route, routeLoading, itinerary, itineraryLoading,
    invalidarTamanho, voarPara,
  };
}
