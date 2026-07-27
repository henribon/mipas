// Wrapper fino sobre o Leaflet: inicialização do mapa e sincronização dos marcadores.
window.Mipas = window.Mipas || {};

(function () {
  function buildMarkerIcon(list) {
    const color = list ? list.color : '#FF5C38';
    const emoji = list ? list.emoji : '📍';
    // Badge circular moderno (círculo + ponta indicando o ponto exato), em vez
    // do teardrop fino de antes.
    return L.divIcon({
      className: '', iconSize: [36, 46], iconAnchor: [18, 44],
      html: `<div class="pin-anim" style="width:36px;height:46px;position:relative;filter:drop-shadow(0 3px 6px rgba(0,0,0,.45))">
        <svg width="36" height="46" viewBox="0 0 36 46" style="position:absolute;inset:0">
          <path d="M18 44L12 32H24L18 44Z" fill="${color}"/>
          <circle cx="18" cy="16" r="15" fill="${color}" stroke="#fff" stroke-width="2.5"/>
        </svg>
        <div style="position:absolute;top:2px;left:0;width:36px;text-align:center;font-size:15px;line-height:32px">${emoji}</div>
      </div>`,
    });
  }

  function initMap(container) {
    const map = L.map(container, { zoomControl: false, attributionControl: true });
    map.setView([-23.561, -46.656], 12);
    // Tiles do CartoDB Voyager (gratuitos, sem chave de API): tom baixo/acinzentado
    // (nem escuro nem branco-estourado) com boas linhas de contraste nas vias,
    // ao contrário do "dark_all" anterior (monocromático demais).
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);
    return map;
  }

  function syncMarkers(map, markersRef, places, lists, onMarkerClick) {
    Object.values(markersRef.current).forEach(mk => mk.remove());
    markersRef.current = {};
    places.forEach(p => {
      const list = lists.find(l => l.id === p.list_id);
      const marker = L.marker([p.latitude, p.longitude], { icon: buildMarkerIcon(list) }).addTo(map);
      marker.on('click', () => onMarkerClick(p));
      markersRef.current[p.id] = marker;
    });
  }

  window.Mipas.map = { initMap, syncMarkers, buildMarkerIcon };
})();
