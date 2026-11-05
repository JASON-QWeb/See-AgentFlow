import { basename } from 'node:path';

export function textOf(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join('\n');
  if (!value) return '';
  if (value.text !== undefined) return textOf(value.text);
  if (value.thinking) return value.thinking;
  if (value.type === 'image' || value.type === 'input_image') return '[image · available in raw record]';
  if (value.content !== undefined) return textOf(value.content);
  return JSON.stringify(value, null, 2);
}

function event(kind, text, extra = {}) {
  return { kind, text: text || '', ...extra };
}

function codex(record, session) {
  const p = record.payload || {};
  if (record.type === 'session_meta' || record.type === 'turn_context') {
    session.cwd = p.cwd || session.cwd;
    session.model = p.model || session.model;
    session.title = basename(session.cwd || '') || session.title;
    return [];
  }
  if (record.type === 'token_usage_record') {
    session.tokens = p.thread_token_usage?.total_tokens ?? session.tokens;
    return [];
  }
  if (record.type === 'event_msg') {
    if (p.type === 'task_started') session.state = 'working';
    if (['task_complete', 'turn_aborted'].includes(p.type)) session.state = 'idle';
    if (p.type === 'token_count' && p.info?.total_token_usage) {
      session.tokens = p.info.total_token_usage.total_tokens;
    }
    return [];
  }
  // response_item is canonical; event_msg mirrors must not double-count traffic.
  if (record.type !== 'response_item') return [];
  if (p.type === 'message') {
    const kind = p.role === 'user' ? 'input' : p.role === 'assistant' ? 'output' : 'context';
    return [event(kind, textOf(p.content), { role: p.role })];
  }
  if (['function_call', 'custom_tool_call'].includes(p.type)) {
    return [event('tool_call', textOf(p.arguments ?? p.input), { tool: p.name, callId: p.call_id })];
  }
  if (['function_call_output', 'custom_tool_call_output'].includes(p.type)) {
    return [event('tool_result', textOf(p.output), { callId: p.call_id })];
  }
  if (p.type === 'reasoning' && p.summary?.length) return [event('reasoning', textOf(p.summary))];
  if (p.type === 'reasoning') return [];
  return [event('context', textOf(p), { role: p.role || p.type })];
}

function claude(record, session) {
  session.cwd = record.cwd || session.cwd;
  session.model = record.message?.model || session.model;
  session.title = record.customTitle || record.agentName || session.title;
  if (!session.title || session.title === session.shortId) session.title = basename(session.cwd || '') || session.shortId;
  if (record.type === 'cost-state') {
    session.tokens = Object.values(record.modelUsage || {}).reduce((n, u) =>
      n + (u.inputTokens || 0) + (u.outputTokens || 0) + (u.cacheReadInputTokens || 0) + (u.cacheCreationInputTokens || 0), 0);
  }
  if (!['user', 'assistant'].includes(record.type)) return [];
  const content = record.message?.content;
  if (typeof content === 'string') return [event(record.type === 'user' ? 'input' : 'output', content)];
  return (content || []).map(block => {
    if (block.type === 'tool_use') return event('tool_call', textOf(block.input), { tool: block.name, callId: block.id });
    if (block.type === 'tool_result') return event('tool_result', textOf(block.content), { callId: block.tool_use_id, error: !!block.is_error });
    if (block.type === 'thinking') return event('reasoning', block.thinking);
    return event(record.type === 'user' ? 'input' : 'output', textOf(block));
  });
}

export function normalize(record, session) {
  const events = session.provider === 'codex' ? codex(record, session) : claude(record, session);
  const timestamp = Date.parse(record.timestamp);
  return events.map(item => ({ ...item, timestamp: Number.isFinite(timestamp) ? timestamp : null }));
}
