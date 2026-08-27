import { useState } from 'react';
import { supabase } from '@/data';
import { getTheme } from '@/theme';

export const auth = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  },
  async signOut() {
    await supabase.auth.signOut();
  },
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },
  onChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
    return data.subscription;
  },
};

export function LoginForm({ onCancel }: { onCancel: () => void }) {
  const C = getTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (ev) => {
    ev.preventDefault();
    setLoading(true);
    setError('');
    try {
      await auth.signIn(email, password);
      onCancel();
    } catch (e) {
      setError('Email ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 950 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', animation: 'fadeIn .2s' }} />
      <form onSubmit={submit} style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
        background: C.surface, border: `1px solid ${C.line}`, borderRadius: 20, padding: '24px 22px', width: 300, maxWidth: '86vw',
        display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 20px 50px rgba(0,0,0,.5)',
      }}>
        <div style={{ fontFamily: 'var(--display-font)', fontSize: 19, fontWeight: 400, color: C.ink }}>Entrar</div>
        <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
          style={{ border: `1.5px solid ${C.line}`, background: C.paper, borderRadius: 12, padding: '11px 14px', fontSize: 15, fontWeight: 600, color: C.ink, boxSizing: 'border-box' }} />
        <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha"
          style={{ border: `1.5px solid ${C.line}`, background: C.paper, borderRadius: 12, padding: '11px 14px', fontSize: 15, fontWeight: 600, color: C.ink, boxSizing: 'border-box' }} />
        {error && <div style={{ color: '#FF6B5B', fontSize: 13, fontWeight: 600 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onCancel} style={{ flex: 1, border: 'none', borderRadius: 12, padding: '12px', background: C.cream, color: C.ink, fontFamily: 'Inter', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={loading} style={{ flex: 1, border: 'none', borderRadius: 12, padding: '12px', background: C.coral, color: '#fff', fontFamily: 'Inter', fontWeight: 700, cursor: 'pointer', opacity: loading ? .6 : 1 }}>{loading ? '...' : 'Entrar'}</button>
        </div>
      </form>
    </div>
  );
}
