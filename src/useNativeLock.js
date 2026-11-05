import { useCallback, useEffect, useState } from 'react';

const bridge = () => window.webkit?.messageHandlers?.agentLock;

export function useNativeLock() {
  const [state, setState] = useState({ available: !!bridge(), configured: false, afterSaver: true, storageAvailable: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!bridge()) return;
    try { setState(await bridge().postMessage({ action: 'status' })); }
    catch { setError('Password settings are unavailable.'); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const request = async (action, values = {}) => {
    if (!bridge()) return null;
    setBusy(true); setError('');
    try {
      const result = await bridge().postMessage({ action, ...values });
      if (result?.available) setState(result);
      return result;
    } catch { setError('Password settings are unavailable.'); return null; }
    finally { setBusy(false); }
  };
  return { ...state, busy, error, refresh,
    configure: () => request('configure'),
    fullscreen: () => request('fullscreen'),
    setAfterSaver: enabled => request('afterSaver', { enabled }),
  };
}
