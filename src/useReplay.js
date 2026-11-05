import { useEffect } from 'react';

export function useReplay(visual, immersive, provider) {
  useEffect(() => {
    const state = visual.current;
    state.replayEvents = [];
    state.replayStatus = immersive ? 'loading' : 'idle';
    state.replayRevision = (state.replayRevision || 0) + 1;
    if (!immersive) return;
    const controller = new AbortController();
    fetch(`/api/replay?provider=${encodeURIComponent(provider)}`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('History unavailable'); return response.json(); })
      .then(body => {
        if (controller.signal.aborted) return;
        state.replayEvents = body.events || [];
        state.replayStatus = 'ready';
        state.replayRevision++;
      })
      .catch(error => {
        if (error.name === 'AbortError') return;
        state.replayStatus = 'error';
        state.replayRevision++;
      });
    return () => controller.abort();
  }, [visual, immersive, provider]);
}
