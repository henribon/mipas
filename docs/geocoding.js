// Busca de endereço via Nominatim (OpenStreetMap) — API pública, gratuita, sem chave.
// Navegadores não permitem customizar o header User-Agent em fetch(); a política de uso
// do Nominatim aceita a identificação via Referer (origem do site) para uso de baixo volume,
// que é o nosso caso. Manter o debounce para respeitar o rate limit informal (~1 req/s).
window.Mipas = window.Mipas || {};

(function () {
  async function geocodeAddress(query) {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=5&q=' + encodeURIComponent(query);
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    if (!res.ok) throw new Error('Falha ao buscar endereço');
    const results = await res.json();
    return results.map(r => ({ address: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }));
  }

  function debounce(fn, delay) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // Distância em linha reta (km) entre dois pontos — fórmula de Haversine.
  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Nominatim devolve "1533, Rua Bela Cintra, Cerqueira César, Jardim Paulista,
  // São Paulo, Região Sudeste, 01415-007, Brasil" — pra exibição queremos só
  // "Rua Bela Cintra, 1533 – Cerqueira César". O endereço completo continua
  // guardado no banco; isso aqui é só formatação de tela.
  function shortAddress(full) {
    const parts = String(full).split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) return full;
    if (/^\d+[a-zA-Z]?$/.test(parts[0])) {
      return parts[1] + ', ' + parts[0] + (parts[2] ? ' – ' + parts[2] : '');
    }
    return parts[0] + ' – ' + parts[1];
  }

  window.Mipas.geocodeAddress = geocodeAddress;
  window.Mipas.debounce = debounce;
  window.Mipas.haversineKm = haversineKm;
  window.Mipas.shortAddress = shortAddress;
})();
