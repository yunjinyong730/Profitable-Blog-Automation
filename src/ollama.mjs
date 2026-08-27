import http from 'node:http';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assertShape(schema, value, path = '$') {
  if (!schema || typeof schema !== 'object') return;
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Expected object at ${path}.`);
    for (const key of schema.required || []) if (!(key in value)) throw new Error(`Missing required field ${path}.${key}.`);
    for (const [key, child] of Object.entries(schema.properties || {})) if (key in value) assertShape(child, value[key], `${path}.${key}`);
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) throw new Error(`Expected array at ${path}.`);
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) throw new Error(`Too few items at ${path}.`);
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) throw new Error(`Too many items at ${path}.`);
    value.forEach((item, index) => assertShape(schema.items, item, `${path}[${index}]`));
  } else if (schema.type === 'string' && typeof value !== 'string') throw new Error(`Expected string at ${path}.`);
  else if (schema.type === 'boolean' && typeof value !== 'boolean') throw new Error(`Expected boolean at ${path}.`);
  else if (schema.type === 'integer' && !Number.isInteger(value)) throw new Error(`Expected integer at ${path}.`);
}

const cleanBase = (baseUrl) => baseUrl.replace(/\/$/, '');

function localHttpJson({ url, method = 'GET', body = null, timeoutMs = 30_000, maxBytes = 24 * 1024 * 1024 }) {
  const target = new URL(url);
  if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(target.hostname)) {
    throw new Error(`Refusing non-local Ollama transport target: ${target.origin}`);
  }
  const payload = body == null ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      fn(value);
    };
    const req = http.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      method,
      agent: false,
      headers: payload == null ? {} : {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let size = 0;
      const chunks = [];
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          req.destroy(new Error(`Ollama response exceeded ${maxBytes} bytes.`));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = {};
        if (text.trim()) {
          try { json = JSON.parse(text); }
          catch { return finish(reject, new Error(`Ollama returned invalid JSON (${res.statusCode}): ${text.slice(0, 500)}`)); }
        }
        finish(resolve, { status: res.statusCode || 0, json });
      });
      res.on('error', (error) => finish(reject, error));
    });
    req.on('error', (error) => finish(reject, error));
    const deadline = setTimeout(() => {
      const error = new Error(`Ollama local request exceeded ${Math.round(timeoutMs / 1000)}s.`);
      error.code = 'OLLAMA_REQUEST_TIMEOUT';
      req.destroy(error);
    }, timeoutMs);
    if (payload != null) req.write(payload);
    req.end();
  });
}

async function ollamaHealthy(baseUrl) {
  try {
    const result = await localHttpJson({ url: `${cleanBase(baseUrl)}/api/tags`, timeoutMs: 5000 });
    return result.status >= 200 && result.status < 300;
  } catch {
    return false;
  }
}

export async function ensureModel({ baseUrl, model }) {
  const base = cleanBase(baseUrl);
  const tags = await fetch(`${base}/api/tags`).then((r) => r.json()).catch(() => ({ models: [] }));
  if ((tags.models || []).some((m) => m.name === model || m.model === model)) return;
  console.log(`[model] pulling ${model} ...`);
  const response = await fetch(`${base}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: true })
  });
  if (!response.ok) throw new Error(`Failed to pull ${model}: ${response.status}`);
  if (!response.body) {
    console.log(`[model] ready ${model}`);
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastPct = -10;
  let lastStatus = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      if (event.error) throw new Error(`Failed to pull ${model}: ${event.error}`);
      const status = String(event.status || '');
      if (event.total && event.completed) {
        const pct = Math.floor((event.completed / event.total) * 100);
        if (pct >= lastPct + 10) {
          lastPct = pct;
          console.log(`[model] ${model} download ${Math.min(100, pct)}%`);
        }
      } else if (status && status !== lastStatus) {
        lastStatus = status;
        console.log(`[model] ${model}: ${status}`);
      }
    }
  }
  console.log(`[model] ready ${model}`);
}

export async function removeModel({ baseUrl, model }) {
  try {
    await fetch(`${cleanBase(baseUrl)}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model })
    });
    console.log(`[model] removed ${model} from runner disk`);
  } catch (error) {
    console.warn(`[model] cleanup skipped for ${model}: ${error.message}`);
  }
}

export async function structuredResponse({
  baseUrl = 'http://127.0.0.1:11434',
  model,
  schema,
  instructions,
  input,
  temperature = 0.2,
  contextWindow = 16384,
  maxOutputTokens = 3500,
  timeoutMs = 900000
}) {
  const started = Date.now();
  const body = {
    model,
    stream: false,
    think: false,
    keep_alive: '30s',
    format: schema,
    messages: [
      { role: 'system', content: `${instructions}\nReturn only data matching this JSON schema exactly:\n${JSON.stringify(schema)}` },
      { role: 'user', content: input }
    ],
    options: { temperature, num_ctx: contextWindow, num_predict: maxOutputTokens }
  };

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const attemptStarted = Date.now();
    console.log(`[model] ${model} generating (attempt ${attempt}/2, timeout ${Math.round(timeoutMs / 60_000)}m) ...`);
    const heartbeat = setInterval(() => {
      const elapsed = Math.round((Date.now() - attemptStarted) / 1000);
      console.log(`[model] ${model} still generating ... ${elapsed}s elapsed`);
    }, 60_000);
    heartbeat.unref?.();
    try {
      const response = await localHttpJson({
        url: `${cleanBase(baseUrl)}/api/chat`,
        method: 'POST',
        body,
        timeoutMs
      });
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Ollama ${response.status}: ${JSON.stringify(response.json)}`);
      }
      const payload = response.json;
      const text = payload.message?.content;
      if (!text) throw new Error('Ollama response contained no message content.');
      const data = JSON.parse(text);
      assertShape(schema, data);
      const seconds = Math.round((Date.now() - started) / 1000);
      console.log(`[model] ${model} completed in ${seconds}s (${payload.eval_count || '?'} output tokens)`);
      return {
        data,
        metrics: {
          totalDuration: payload.total_duration || null,
          evalCount: payload.eval_count || null,
          wallSeconds: seconds
        }
      };
    } catch (error) {
      lastError = error;
      const elapsed = Math.round((Date.now() - attemptStarted) / 1000);
      console.warn(`[model] ${model} attempt ${attempt} failed after ${elapsed}s: ${error.code || error.name || 'Error'} ${error.message}`);
      if (error.code === 'OLLAMA_REQUEST_TIMEOUT' || attempt === 2) break;
      const healthy = await ollamaHealthy(baseUrl);
      console.warn(`[model] Ollama health before retry: ${healthy ? 'ok' : 'unavailable'}`);
      if (!healthy) throw error;
      await sleep(2000);
    } finally {
      clearInterval(heartbeat);
    }
  }
  throw lastError;
}
