import { useState } from 'react';
import { client } from '../../lib/api/client';

const kinds = ['openai', 'anthropic', 'openrouter', 'openai-compatible'] as const;
type Kind = typeof kinds[number];
export function ProviderConnect({ onConnected, onClose }: { onConnected: () => void; onClose?: () => void }) {
  const [kind, setKind] = useState<Kind>('openai');
  const [id, setId] = useState('openai');
  const [key, setKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  return <div className="onboarding"><div className="onboarding-body"><form className="onboarding-card form" onSubmit={async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await client.providers.create({ id, kind, apiKey: key, ...(baseUrl ? { baseUrl } : {}) });
      onConnected();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Provider setup failed'); }
    finally { setSaving(false); }
  }}>
    <h1>Connect a real provider</h1><p>A remote provider is required before an agent can reply. The API key is stored on your OpenCrew server.</p>
    <label>Provider<select value={kind} onChange={(e) => { const next = e.target.value as Kind; setKind(next); setId(next); }}>
      {kinds.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    <label>Provider ID<input required value={id} onChange={(e) => setId(e.target.value)} /></label>
    <label>API key<input required type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} /></label>
    {kind === 'openai-compatible' && <label>Base URL<input required type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} /></label>}
    {error && <p role="alert">{error}</p>}
    <button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save provider'}</button>
    {onClose && <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>}
  </form></div></div>;
}
