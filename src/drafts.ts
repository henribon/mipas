
const CHAVES = {
  place: 'mipas-draft-place',
  wish: 'mipas-draft-wish',
};

type Tipo = keyof typeof CHAVES;

const soTexto = (v) => String(v ?? '').replace(/<[^>]*>/g, ' ').trim();

export const draftPreenchido = (d) => {
  if (!d) return false;
  if ((d.photos || []).length > 0) return true;
  return [d.name, d.category, d.rating, d.description, d.avg_price, d.instagram, d.note]
    .some(v => soTexto(v) !== '');
};

export function loadDraft(tipo: Tipo) {
  try {
    const bruto = localStorage.getItem(CHAVES[tipo]);
    if (!bruto) return null;
    const d = JSON.parse(bruto);
    if (!d || typeof d !== 'object') return null;
    if (!d.address && tipo !== 'place') return null;
    return tipo === 'place' ? { ...d, photos: [] } : d;
  } catch {
    return null;
  }
}

export function saveDraft(tipo: Tipo, draft) {
  try {
    const { photos, ...resto } = draft;
    localStorage.setItem(CHAVES[tipo], JSON.stringify(resto));
  } catch {
  }
}

export function clearDraft(tipo: Tipo) {
  try {
    localStorage.removeItem(CHAVES[tipo]);
  } catch {}
}
