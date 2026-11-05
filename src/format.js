const standardCount = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const compactCount = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const clock = new Intl.DateTimeFormat('en-GB', { hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric' });

export const count = value => (value >= 10000 ? compactCount : standardCount).format(value || 0);
export const bytes = value => value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : value >= 1024 ? `${(value / 1024).toFixed(1)} KB` : `${Math.round(value || 0)} B`;
export const time = value => value ? clock.format(value) : '—';
export const labels = { input: 'INPUT', output: 'OUTPUT', tool_call: 'CALL', tool_result: 'RETURN', reasoning: 'THINK', context: 'CONTEXT', raw: 'RAW' };
export const age = (value, t = (message, values) => message.replace('{count}', values?.count)) => {
  const seconds = (Date.now() - value) / 1000;
  if (seconds < 60) return t('JUST NOW');
  if (seconds < 3600) return t('{count}m AGO', { count: Math.floor(seconds / 60) });
  if (seconds < 86400) return t('{count}h AGO', { count: Math.floor(seconds / 3600) });
  return t('{count}d AGO', { count: Math.floor(seconds / 86400) });
};
