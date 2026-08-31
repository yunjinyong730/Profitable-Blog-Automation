import http from 'node:http';
import { structuredResponse } from '../src/ollama.mjs';

const sectionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    heading: { type: 'string' },
    paragraphs: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string' } },
    bullets: { type: 'array', maxItems: 2, items: { type: 'string' } }
  },
  required: ['heading', 'paragraphs', 'bullets']
};

const draftLikeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    slug: { type: 'string' },
    sections: { type: 'array', minItems: 2, maxItems: 3, items: sectionSchema }
  },
  required: ['title', 'slug', 'sections']
};

const qaLikeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    revisedTitle: { type: 'string' },
    revisedDescription: { type: 'string' },
    revisedSections: { type: 'array', minItems: 2, maxItems: 3, items: sectionSchema }
  },
  required: ['revisedTitle', 'revisedDescription', 'revisedSections']
};

let primaryCalls = 0;
let repairCalls = 0;
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
    res.writeHead(200, { 'content-type': 'application/json' });

    if (requestBody.format?.properties?.additions) {
      repairCalls += 1;
      const paragraphA = `보강 ${repairCalls}A: ` + '근거가 있는 설명을 독자가 실제로 적용할 수 있도록 구체화합니다. 선택 기준과 한계, 실행 순서를 연결하되 기존 결론과 사실관계를 바꾸지 않습니다. '.repeat(18);
      const paragraphB = `보강 ${repairCalls}B: ` + '또 다른 관점에서 입력 근거에 포함된 제약과 확인 사항을 풀어 설명합니다. 독자가 판단할 수 있도록 기존 사실의 의미와 적용 조건을 구체화합니다. '.repeat(20);
      res.end(JSON.stringify({
        message: {
          content: JSON.stringify({
            additions: [
              { sectionIndex: 0, paragraphs: [paragraphA] },
              { sectionIndex: 1, paragraphs: [paragraphB] }
            ]
          })
        },
        eval_count: 700,
        total_duration: 1
      }));
      return;
    }

    primaryCalls += 1;
    const short = '짧지만 검증된 기존 본문입니다. '.repeat(35);
    const sections = [
      { heading: '첫 번째 섹션', paragraphs: [short], bullets: [] },
      { heading: '두 번째 섹션', paragraphs: [short], bullets: [] }
    ];
    const payload = requestBody.format?.properties?.revisedSections
      ? { revisedTitle: '검증된 최종 제목', revisedDescription: '검증된 최종 설명을 충분한 한국어로 제공합니다.', revisedSections: sections }
      : { title: '테스트 초안', slug: 'test-draft', sections };
    res.end(JSON.stringify({
      message: { content: JSON.stringify(payload) },
      eval_count: 100,
      total_duration: 1
    }));
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();

try {
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const draft = await structuredResponse({
    baseUrl,
    model: 'depth-repair-test',
    schema: draftLikeSchema,
    instructions: 'Write only from supplied evidence.',
    input: 'ORIGINAL EVIDENCE: verified facts only.',
    timeoutMs: 3000,
    maxOutputTokens: 100,
    contextWindow: 2048
  });
  const draftChars = draft.data.sections.flatMap((section) => section.paragraphs).join('').length;
  if (draftChars < 1000) throw new Error(`Draft handoff did not clear 1000 chars: ${draftChars}.`);
  if (draft.data.slug !== '') throw new Error('Draft handoff wrapper should synthesize an empty slug for downstream fallback.');
  if (repairCalls !== 0) throw new Error('Draft handoff must not spend an expensive qwen3:8b append-only repair call.');

  const draftRequest = requestBodies[0];
  if (draftRequest.format?.properties?.slug) throw new Error('Draft handoff schema still exposed slug and would trigger the legacy 3000-char depth policy.');
  if (!String(draftRequest.messages?.[0]?.content || '').includes('final 3500+ character publication requirement')) {
    throw new Error('Draft handoff instructions do not clearly delegate final depth to QA.');
  }

  const qa = await structuredResponse({
    baseUrl,
    model: 'depth-repair-test',
    schema: qaLikeSchema,
    instructions: 'Fact check using only supplied evidence.',
    input: 'ORIGINAL EVIDENCE: verified facts only.',
    timeoutMs: 3000,
    maxOutputTokens: 100,
    contextWindow: 2048
  });
  const qaChars = qa.data.revisedSections.flatMap((section) => section.paragraphs).join('').length;
  if (qaChars < 3500) throw new Error(`QA append-only repair did not clear 3500 chars: ${qaChars}.`);

  if (primaryCalls !== 2) throw new Error(`Expected two primary generations, got ${primaryCalls}.`);
  if (repairCalls !== 1) throw new Error(`Expected only one append-only repair for final QA, got ${repairCalls}.`);

  const qaPrimaryBody = requestBodies.find((body) => body.format?.properties?.revisedSections);
  if (!qaPrimaryBody) throw new Error('No QA primary request was issued.');
  if ((qaPrimaryBody.options?.num_predict || 0) < 4000) throw new Error('QA primary output budget was not raised to support the 3500-char final requirement.');
  if (!String(qaPrimaryBody.messages?.[0]?.content || '').includes('target at least 3800 Korean characters')) {
    throw new Error('QA primary prompt is missing the explicit final-depth target.');
  }

  const repairBody = requestBodies.find((body) => body.format?.properties?.additions);
  if (!repairBody) throw new Error('No final QA append-only repair request was issued.');
  const repairPrompt = repairBody.messages?.at(-1)?.content || '';
  if (!repairPrompt.includes('append-only') || !repairPrompt.includes('ORIGINAL INPUT') || !repairPrompt.includes('without rewriting or deleting existing text')) {
    throw new Error('Append-only repair prompt is missing preservation/evidence safeguards.');
  }

  const preserved = qa.data.revisedSections[0].paragraphs[0];
  if (!preserved.startsWith('짧지만 검증된 기존 본문입니다.')) throw new Error('Append-only QA repair rewrote the existing article instead of preserving it.');

  console.log(`Draft handoff + final QA depth policy OK: draft=${draftChars} chars without 8B repair, QA=${qaChars} chars after guarded repair.`);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
