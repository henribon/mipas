import { useEffect, useState } from 'react';

export const MQ_DESKTOP = '(min-width: 720px)';
export const telaGrande = () => window.matchMedia(MQ_DESKTOP).matches;

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(telaGrande);

  useEffect(() => {
    const mq = window.matchMedia(MQ_DESKTOP);
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}
