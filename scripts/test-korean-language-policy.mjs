import http from 'node:http';
import { structuredResponse } from '../src/ollama.mjs';
import { KOREAN_FIRST_SYSTEM_RULES, koreanLanguageIssues } from '../src/language.mjs';

const topicSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    candidates: {
      type: 'array', minItems: 1, maxItems: 1,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          topic: { type: 'string' },
          primaryKeyword: { type: 'string' },
          readerProblem: { type: 'string' },
          expectedOutcome: { type: 'string' }
        },
        required: ['topic', 'primaryKeyword', 'readerProblem', 'expectedOutcome']
      }
    }
  },
  required: ['candidates']
};

const englishCandidate = {
  candidates: [{
    topic: 'Best AI coding tools for developers',
    primaryKeyword: 'AI coding tools',
    readerProblem: 'Developers need to choose the right coding assistant',
    expectedOutcome: 'Better productivity and code quality'
  }]
};
const koreanCandidate = {
  candidates: [{
    topic: '개발자를 위한 AI 코딩 도구 비교와 선택 기준',
    primaryKeyword: 'AI coding tools',
    readerProblem: '개발자가 팀과 작업 방식에 맞는 AI 코딩 도구를 고르기 어렵다.',
    expectedOutcome: 'GitHub Copilot과 Claude Code 같은 제품을 비교해 적합한 도구를 선택할 수 있다.'
  }]
};

if (!koreanLanguageIssues(topicSchema, englishCandidate).length) {
  throw new Error('English-first topic metadata should fail the Korean language policy.');
}
if (koreanLanguageIssues(topicSchema, koreanCandidate).length) {
  throw new Error(`Korean-first metadata with English product/keyword terms should pass: ${koreanLanguageIssues(topicSchema, koreanCandidate).join(' | ')}`);
}
if (!KOREAN_FIRST_SYSTEM_RULES.includes('proper product/brand/model names')) {
  throw new Error('Korean-first system rules must preserve established product names.');
}

const articleLikeSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    sections: { type: 'array', items: { type: 'object' } },
    faq: { type: 'array', items: { type: 'object' } }
  }
};
const badArticle = {
  title: 'AI Coding Tools in 2026',
  description: 'A guide to choosing coding assistants for developers and improving productivity.',
  category: 'Developer Tools',
  tags: ['AI', 'coding assistants'],
  sections: [{ heading: 'Introduction', paragraphs: ['This is an English article body that should not be published on a Korean-first site.'] }],
  faq: [{ question: 'Which tool is best?', answer: 'It depends on the workflow.' }]
};
const badArticleIssues = koreanLanguageIssues(articleLikeSchema, badArticle);
for (const field of ['article.title', 'article.description', 'article.category', 'article.tags', 'article.body', 'article.faq']) {
  if (!badArticleIssues.some((issue) => issue.startsWith(field))) throw new Error(`Missing Korean guard for ${field}`);
}

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
    requestBodies.push(JSON.parse(raw));
    chatCalls += 1;
    const content = chatCalls === 1 ? englishCandidate : koreanCandidate;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      message: { content: JSON.stringify(content) },
      eval_count: 100,
      total_duration: 1
    }));
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
try {
  const result = await structuredResponse({
    baseUrl: `http://127.0.0.1:${address.port}`,
    model: 'korean-policy-test',
    schema: topicSchema,
    instructions: 'Choose a useful topic.',
    input: 'Use the supplied evidence.',
    timeoutMs: 3000,
    maxOutputTokens: 300,
    contextWindow: 2048
  });

  if (chatCalls !== 2) throw new Error(`Expected one automatic Korean repair, got ${chatCalls} calls.`);
  if (koreanLanguageIssues(topicSchema, result.data).length) throw new Error('Automatic Korean repair did not clear the policy.');
  const systemPrompt = requestBodies[0]?.messages?.[0]?.content || '';
  if (!systemPrompt.includes('Korean-first publication language policy')) throw new Error('Korean-first system policy was not applied to the model call.');
  const repairPrompt = requestBodies[1]?.messages?.at(-1)?.content || '';
  if (!repairPrompt.includes('한국어 우선 언어 정책') || !repairPrompt.includes('새 사실')) {
    throw new Error('Automatic Korean repair prompt is missing language/fact-preservation safeguards.');
  }
  console.log('Korean-first language policy OK: English-first metadata is detected, repaired once, and product/keyword names may remain English.');
} finally {
  await new Promise((resolve) => server.close(resolve));
}
