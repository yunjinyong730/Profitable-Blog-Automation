const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assertShape(schema, value, path = '$') {
  if (!schema || typeof schema !== 'object') return;
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Expected object at ${path}.`);
    for (const key of schema.required || []) {
      if (!(key in value)) throw new Error(`Missing required field ${path}.${key}.`);
    }
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (key in value) assertShape(child, value[key], `${path}.${key}`);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) throw new Error(`Expected array at ${path}.`);
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) throw new Error(`Too few items at ${path}.`);
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) throw new Error(`Too many items at ${path}.`);
    value.forEach((item, index) => assertShape(schema.items, item, `${path}[${index}]`));
  } else if (schema.type === 'string' && typeof value !== 'string') {
    throw new Error(`Expected string at ${path}.`);
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') {
    throw new Error(`Expected boolean at ${path}.`);
  } else if (schema.type === 'integer' && !Number.isInteger(value)) {
    throw new Error(`Expected integer at ${path}.`);
  }
}

export async function structuredResponse({
  baseUrl = 'http://127.0.0.1:11434',
  model = 'qwen3:8b',
  schema,
  instructions,
  input,
  temperature = 0.2,
  contextWindow = 16384,
  maxOutputTokens = 3500,
  timeoutMs = 900000
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const body = {
    model,
    stream: false,
    think: false,
    format: schema,
    messages: [
      { role: 'system', content: `${instructions}\nReturn only data matching this JSON schema exactly:\n${JSON.stringify(schema)}` },
      { role: 'user', content: input }
    ],
    options: {
      temperature,
      num_ctx: contextWindow,
      num_predict: maxOutputTokens
    }
  };

  let lastError;
  try {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`Ollama ${response.status}: ${JSON.stringify(payload)}`);
        const text = payload.message?.content;
        if (!text) throw new Error('Ollama response contained no message content.');
        const data = JSON.parse(text);
        assertShape(schema, data);
        return { data, metrics: { totalDuration: payload.total_duration || null, evalCount: payload.eval_count || null } };
      } catch (error) {
        lastError = error;
        if (error?.name === 'AbortError' || attempt === 2) break;
        await sleep(1500);
      }
    }
  } finally {
    clearTimeout(timer);
  }
  throw lastError;
}
