import { useEffect, useState } from 'react';
import { loadDraft, saveDraft, clearDraft, draftPreenchido } from '@/drafts';

export function useDrafts(canEdit) {
  const [draft, setDraft] = useState(null);
  const [wishDraft, setWishDraft] = useState(null);

  useEffect(() => {
    if (!canEdit) return;
    setDraft(d => d || loadDraft('place'));
    setWishDraft(d => d || loadDraft('wish'));
  }, [canEdit]);

  useEffect(() => {
    if (draftPreenchido(draft)) saveDraft('place', draft);
    else if (draft) clearDraft('place');
  }, [draft]);

  useEffect(() => {
    if (draftPreenchido(wishDraft)) saveDraft('wish', wishDraft);
    else if (wishDraft) clearDraft('wish');
  }, [wishDraft]);

  const descartarDraft = () => {
    if (draftPreenchido(draft) && !confirm('Descartar o que você preencheu sobre esse lugar?')) return;
    clearDraft('place');
    setDraft(null);
  };

  const descartarWishDraft = () => {
    if (draftPreenchido(wishDraft) && !confirm('Descartar o que você preencheu sobre esse lugar?')) return;
    clearDraft('wish');
    setWishDraft(null);
  };

  return { draft, setDraft, wishDraft, setWishDraft, descartarDraft, descartarWishDraft };
}
