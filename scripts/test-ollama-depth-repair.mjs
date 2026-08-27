import http from 'node:http';
import { structuredResponse } from '../src/ollama.mjs';

const sectionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    heading: { type: 'string' },
    paragraphs: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string' } },
    bullets: { type: 'array', maxItems: 2, items: { type: 'string' } }
  },
  required: ['heading', 'paragraphs', 'bullets']
};

const qaLikeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    revisedSections: { type: 'array', minItems: 1, maxItems: 2, items: sectionSchema }
  },
  required: ['revisedSections']
};

let chatCalls = 0;
const requestBodies = [];
const server = http.createServer((req, res) => {
  if (req.url !== '/api/chat') {
    res.writeHead(404);
    res.end();
    return;
  }
  let raw = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    const requestBody = JSON.parse(raw);
    requestBodies.push(requestBody);
    chatCalls += 1;
    const paragraph = chatCalls === 1 ? '짧은 본문'.repeat(20) : '근거 기반으로 충분히 보강된 본문입니다. '.repeat(190);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      message: {
        content: JSON.stringify({
          revisedSections: [{ heading: '검증된 본문', paragraphs: [paragraph], bullets: [] }]
        })
      },
      eval_count: chatCalls === 1 ? 100 : 1200,
      total_duration: 1
    }));
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
try {
  const result = await structuredResponse({
    baseUrl: `http://127.0.0.1:${address.port}`,
    model: 'depth-repair-test',
    schema: qaLikeSchema,
    instructions: 'Fact check the article.',
    input: 'Use only supplied evidence.',
    timeoutMs: 3000,
    maxOutputTokens: 100,
    contextWindow: 2048
  });

  const chars = result.data.revisedSections.flatMap((section) => section.paragraphs).join('').length;
  if (chatCalls !== 2) throw new Error(`Expected exactly one automatic depth repair, got ${chatCalls} chat calls.`);
  if (chars < 3500) throw new Error(`Depth repair did not reach the final publication floor: ${chars} chars.`);
  if ((requestBodies[1]?.options?.num_predict || 0) < 5200) throw new Error('Depth repair did not raise the QA output budget.');
  const repairPrompt = requestBodies[1]?.messages?.at(-1)?.content || '';
  if (!repairPrompt.includes('evidence-grounded') || !repairPrompt.includes('at least 4200')) {
    throw new Error('Depth repair request is missing evidence/target-length safeguards.');
  }
  console.log(`Ollama depth repair OK: thin QA output was expanded to ${chars} paragraph chars before publication.`);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
