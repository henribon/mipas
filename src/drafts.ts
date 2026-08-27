// Rascunhos: o que foi preenchido e não salvo sobrevive a fechar a aba por
// acaso. Só as fotos ficam de fora — são objetos File, que não cabem no
// localStorage; quem recarrega a página escolhe as fotos de novo.

const CHAVES = {
  place: 'mipas-draft-place',
  wish: 'mipas-draft-wish',
};

type Tipo = keyof typeof CHAVES;

const soTexto = (v) => String(v ?? '').replace(/<[^>]*>/g, ' ').trim();

// Um rascunho "vazio" é o que a busca acabou de abrir e ninguém tocou: não vale
// guardar nem vale perguntar antes de fechar.
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
    // Rascunho de lugar pode ter começado dentro de uma lista, antes de existir
    // endereço; a folha volta no passo da busca. O de desejo, não: a folha dele
    // só mostra o endereço, não tem como escolher um.
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
    // Cota estourada ou storage bloqueado: perder o rascunho não pode derrubar
    // o formulário que está aberto na frente do usuário.
  }
}

export function clearDraft(tipo: Tipo) {
  try {
    localStorage.removeItem(CHAVES[tipo]);
  } catch {}
}
