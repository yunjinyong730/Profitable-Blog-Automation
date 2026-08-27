const API_URL = 'https://api.openai.com/v1/responses';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function outputText(payload) {
  for (const item of payload.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

export async function structuredResponse({
  apiKey,
  model,
  reasoningEffort = 'medium',
  maxOutputTokens = 16000,
  searchContextSize = 'medium',
  name,
  schema,
  instructions,
  input,
  webSearch = false
}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is required.');

  const body = {
    model,
    store: false,
    instructions,
    input,
    reasoning: { effort: reasoningEffort },
    max_output_tokens: maxOutputTokens,
    text: {
      verbosity: 'medium',
      format: { type: 'json_schema', name, strict: true, schema }
    },
    tools: webSearch ? [{ type: 'web_search_preview', search_context_size: searchContextSize }] : [],
    include: webSearch ? ['web_search_call.action.sources'] : undefined
  };

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      if (payload.status === 'incomplete') {
        throw new Error(`OpenAI response incomplete: ${JSON.stringify(payload.incomplete_details || {})}`);
      }
      const text = outputText(payload);
      if (!text) throw new Error('OpenAI response contained no output_text.');
      return { data: JSON.parse(text), usage: payload.usage || null };
    }

    lastError = new Error(`OpenAI API ${response.status}: ${JSON.stringify(payload)}`);
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) break;
    await sleep(1000 * 2 ** (attempt - 1));
  }
  throw lastError;
}
