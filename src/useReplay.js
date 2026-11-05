import { useEffect } from 'react';
import { HIDDEN_RELEASE_DELAY } from './eventRetention.js';

export function useReplay(visual, immersive, provider) {
  useEffect(() => {
    const state = visual.current;
    let controller, refreshTimer, releaseTimer, disposed = false;
    const clear = () => {
      state.replayEvents = []; state.replayStatus = 'idle';
      state.replayRevision = (state.replayRevision || 0) + 1;
    };
    clear();
    if (!immersive) return;
    const load = async () => {
      if (disposed || document.hidden) return;
      const request = new AbortController(); controller = request;
      if (!state.replayEvents.length) state.replayStatus = 'loading';
      try {
        const response = await fetch(`/api/replay?provider=${encodeURIComponent(provider)}`, { signal: request.signal });
        if (!response.ok) throw new Error('History unavailable');
        const body = await response.json();
        if (disposed || request.signal.aborted) return;
        // Replace a small history window; never accumulate replay into live telemetry.
        state.replayEvents = (body.events || []).slice(-96);
        state.replayStatus = 'ready'; state.replayRevision++;
      } catch {
        if (disposed || request.signal.aborted) return;
        state.replayStatus = 'error'; state.replayRevision++;
      } finally {
        if (!disposed && !request.signal.aborted && !document.hidden) refreshTimer = setTimeout(load, 60_000);
      }
    };
    const visibility = () => {
      controller?.abort(); clearTimeout(refreshTimer); clearTimeout(releaseTimer);
      if (document.hidden) releaseTimer = setTimeout(clear, HIDDEN_RELEASE_DELAY);
      else load();
    };
    load(); document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true; controller?.abort(); clearTimeout(refreshTimer); clearTimeout(releaseTimer);
      document.removeEventListener('visibilitychange', visibility); clear();
    };
  }, [visual, immersive, provider]);
}
