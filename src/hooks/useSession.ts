import { useEffect, useState } from 'react';
import { auth } from '@/auth';
import { clearCachesOfOtherUsers, clearPrivateCaches } from '@/cache';
import { errorDetail, isSessionError } from '@/errors';

export function useSession(sharedMode: boolean) {
  const [session, setSession] = useState(auth.storedSession);
  const [authReady, setAuthReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    auth.getSession().then(s => {
      clearCachesOfOtherUsers(s?.user?.id ?? null);
      setSession(s);
      setAuthReady(true);
    });
    const sub = auth.onChange((event, s) => {
      if (event === 'SIGNED_OUT') clearPrivateCaches();
      setSession(s);
    });
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
