import { useEffect, useState, type ReactNode } from 'react';
import { client, clearToken, currentToken, storeToken } from '../../lib/api/client';

export function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<'loading' | 'setup' | 'login' | 'ready'>('loading');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        if (currentToken()) {
          await client.auth.me();
          if (active) { setPhase('ready'); return; }
        }
      } catch { clearToken(); }
      try {
        const status = await client.auth.status();
        if (active) setPhase(status.initialized ? 'login' : 'setup');
      } catch { if (active) setError('Cannot reach the OpenCrew server. Start the server and reload.'); }
    };
    void refresh();
    const logout = () => { setPhase('login'); setPassword(''); };
    window.addEventListener('opencrew:logout', logout);
    return () => { active = false; window.removeEventListener('opencrew:logout', logout); };
  }, []);
  if (phase === 'ready') return <>{children}</>;
  return <div className="onboarding"><div className="onboarding-body"><form className="onboarding-card form" onSubmit={async (event) => {
    event.preventDefault(); setError('');
    try {
      const result = phase === 'setup'
        ? await client.auth.setup({ email, displayName, password })
        : await client.auth.login({ email, password });
      storeToken(result.token); setPhase('ready');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Authentication failed'); }
  }}>
    <h1>{phase === 'setup' ? 'Create first admin' : 'Log in to OpenCrew'}</h1>
    {phase === 'setup' && <label>Name<input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>}
    <label>Email<input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
    <label>Password<input type="password" required minLength={phase === 'setup' ? 8 : 1} autoComplete={phase === 'setup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    {phase !== 'loading' && <button className="primary-button" type="submit">{phase === 'setup' ? 'Create admin' : 'Log in'}</button>}
    {phase === 'login' && <p>First time here? <button type="button" className="text-button" onClick={() => setPhase('setup')}>Try first admin setup</button></p>}
  </form></div></div>;
}
