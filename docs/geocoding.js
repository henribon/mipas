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

  window.Mipas.geocodeAddress = geocodeAddress;
  window.Mipas.debounce = debounce;
})();
