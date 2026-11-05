export const DISPLAY_EVENT_LIMIT = 240;
export const DISPLAY_EVENT_AGE = 5 * 60_000;
export const HIDDEN_RELEASE_DELAY = 15_000;

export function retainRecentEvents(previous, incoming = [], now = Date.now()) {
  const cutoff = now - DISPLAY_EVENT_AGE;
  const kept = previous.filter(event => event.receivedAt > cutoff);
  const known = new Set(kept.map(event => event.id));
  for (const event of incoming) {
    if (event.receivedAt <= cutoff || known.has(event.id)) continue;
    kept.push(event); known.add(event.id);
  }
  const result = kept.slice(-DISPLAY_EVENT_LIMIT);
  return result.length === previous.length && result.every((event, index) => event === previous[index]) ? previous : result;
}
