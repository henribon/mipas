import { useEffect, useState } from 'react';
import { auth } from '@/auth';
import { errorDetail, isSessionError } from '@/errors';

export function useSession(sharedMode: boolean) {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    auth.getSession().then(s => { setSession(s); setAuthReady(true); });
    const sub = auth.onChange(s => setSession(s));
    return () => sub.unsubscribe();
  }, []);

  const canEdit = !sharedMode && !!session;

  const fail = (acao, e) => {
    console.error(`[Mipas] ${acao}:`, e);
    const semSessao = isSessionError(e);
    alert(`${acao}.\n\nMotivo: ${errorDetail(e)}`
      + (semSessao ? '\n\nParece que sua sessão expirou — entre de novo e tente outra vez.' : ''));
    if (!semSessao) return;
    auth.getSession().then(s => {
      setSession(s);
      if (!s) setLoginOpen(true);
    });
  };

  const handleAuthButtonClick = () => {
    if (canEdit) auth.signOut();
    else setLoginOpen(true);
  };

  return { session, authReady, canEdit, loginOpen, setLoginOpen, fail, handleAuthButtonClick };
}
