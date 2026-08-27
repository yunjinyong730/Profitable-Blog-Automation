import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { structuredResponse } from './ollama.mjs';
import { collectEvidence, evidenceForPrompt, allowedSourceMap, canonicalUrl } from './research.mjs';
import { renderArticle, renderFeed, renderIndex, renderSitemap } from './render.mjs';

const ROOT = process.cwd();
const readJson = async (relative) => JSON.parse(await readFile(path.join(ROOT, relative), 'utf8'));
const config = await readJson('config/blog.config.json');
const posts = await readJson('data/posts.json');
const queue = await readJson('data/topic-queue.json');
const timezone = config.publishing?.timezone || 'Asia/Seoul';
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone,
  year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());
const manualTopic = (process.env.BLOG_TOPIC || '').trim();

const modelConfig = {
  baseUrl: (process.env.OLLAMA_BASE_URL || config.localModel.baseUrl).trim(),
  model: (process.env.OLLAMA_MODEL || config.localModel.model).trim(),
  temperature: config.localModel.temperature,
  contextWindow: config.localModel.contextWindow,
  maxOutputTokens: config.localModel.maxOutputTokens,
  timeoutMs: config.localModel.timeoutMs
};

const monetization = {
  adsense: {
    client: (process.env.ADSENSE_CLIENT || '').trim(),
    slot: (process.env.ADSENSE_SLOT || '').trim()
  },
  affiliateLinks: (() => {
    try { return JSON.parse(process.env.AFFILIATE_LINKS_JSON || '[]'); }
    catch { throw new Error('AFFILIATE_LINKS_JSON must be valid JSON.'); }
  })(),
  affiliateDisclosure: (process.env.AFFILIATE_DISCLOSURE || '').trim() || '이 글에는 제휴 링크가 포함될 수 있으며, 링크를 통한 구매 시 추가 비용 없이 운영자에게 수수료가 지급될 수 있습니다.'
};

const topicSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    topic: { type: 'string' }, primaryKeyword: { type: 'string' }, searchIntent: { type: 'string' },
    monetizationAngle: { type: 'string' }, whyNow: { type: 'string' },
    opportunityScore: { type: 'integer', minimum: 0, maximum: 100 }
  },
  required: ['topic', 'primaryKeyword', 'searchIntent', 'monetizationAngle', 'whyNow', 'opportunityScore']
};

const researchSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    thesis: { type: 'string' },
    keyFacts: { type: 'array', minItems: 4, maxItems: 12, items: { type: 'object', additionalProperties: false, properties: {
      claim: { type: 'string' }, sourceTitle: { type: 'string' }, sourceUrl: { type: 'string' }
    }, required: ['claim', 'sourceTitle', 'sourceUrl'] } },
    readerQuestions: { type: 'array', minItems: 3, maxItems: 8, items: { type: 'string' } },
    contentGap: { type: 'string' }, monetizationFit: { type: 'string' },
    caveats: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string' } }
  },
  required: ['thesis', 'keyFacts', 'readerQuestions', 'contentGap', 'monetizationFit', 'caveats']
};

const sectionSchema = { type: 'object', additionalProperties: false, properties: {
  heading: { type: 'string' },
  paragraphs: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string' } },
  bullets: { type: 'array', maxItems: 8, items: { type: 'string' } }
}, required: ['heading', 'paragraphs', 'bullets'] };

const faqItemSchema = { type: 'object', additionalProperties: false, properties: {
  question: { type: 'string' }, answer: { type: 'string' }
}, required: ['question', 'answer'] };

const sourceSchema = { type: 'object', additionalProperties: false, properties: {
  title: { type: 'string' }, url: { type: 'string' }
}, required: ['title', 'url'] };

const articleSchema = { type: 'object', additionalProperties: false, properties: {
  title: { type: 'string' }, slug: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' },
  tags: { type: 'array', minItems: 2, maxItems: 8, items: { type: 'string' } },
  sections: { type: 'array', minItems: 5, maxItems: 9, items: sectionSchema },
  faq: { type: 'array', minItems: 2, maxItems: 5, items: faqItemSchema },
  sources: { type: 'array', minItems: 3, maxItems: 10, items: sourceSchema },
  affiliateOpportunities: { type: 'array', maxItems: 5, items: { type: 'string' } }
}, required: ['title', 'slug', 'description', 'category', 'tags', 'sections', 'faq', 'sources', 'affiliateOpportunities'] };

const qaSchema = { type: 'object', additionalProperties: false, properties: {
  score: { type: 'integer', minimum: 0, maximum: 100 }, approved: { type: 'boolean' },
  revisedTitle: { type: 'string' }, revisedDescription: { type: 'string' },
  revisedSections: { type: 'array', minItems: 5, maxItems: 9, items: sectionSchema },
  revisedFaq: { type: 'array', minItems: 2, maxItems: 5, items: faqItemSchema },
  verifiedSources: { type: 'array', minItems: 3, maxItems: 10, items: sourceSchema },
  warnings: { type: 'array', maxItems: 10, items: { type: 'string' } },
  verificationSummary: { type: 'string' }
}, required: ['score', 'approved', 'revisedTitle', 'revisedDescription', 'revisedSections', 'revisedFaq', 'verifiedSources', 'warnings', 'verificationSummary'] };

const ai = (args) => structuredResponse({ ...modelConfig, ...args });
const researchOptions = config.research || {};

function slugify(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function duplicateKeyword(keyword) {
  const normalized = String(keyword).trim().toLowerCase();
  return posts.some((post) => String(post.primaryKeyword || '').trim().toLowerCase() === normalized);
}

function duplicateTitle(title) {
  const normalized = String(title).trim().toLowerCase();
  return posts.some((post) => String(post.title || '').trim().toLowerCase() === normalized);
}

function whitelistSources(items, sourceMap) {
  const seen = new Set();
  const output = [];
  for (const item of items || []) {
    const key = canonicalUrl(item.url || item.sourceUrl || '');
    const allowed = sourceMap.get(key);
    if (!allowed || seen.has(key)) continue;
    seen.add(key);
    output.push({ title: allowed.title || item.title || item.sourceTitle, url: allowed.url });
  }
  return output;
}

async function chooseTopic() {
  if (manualTopic) return { topic: manualTopic, primaryKeyword: manualTopic, searchIntent: 'manual', monetizationAngle: 'manual', whyNow: 'manual workflow dispatch', opportunityScore: 100 };
  if (queue.length) {
    const queued = queue.shift();
    if (typeof queued === 'string') return { topic: queued, primaryKeyword: queued, searchIntent: 'queued', monetizationAngle: 'queued', whyNow: 'topic queue', opportunityScore: 100 };
    return queued;
  }

  const discoveryDocs = await collectEvidence(config.research.discoveryQueries, researchOptions);
  if (discoveryDocs.length < 3) throw new Error(`Topic discovery found only ${discoveryDocs.length} usable public sources. Add a manual topic or topic queue item and retry.`);
  const recentTitles = posts.slice(0, config.content.recentTitleWindow).map((post) => post.title);
  const { data } = await ai({
    schema: topicSchema,
    instructions: 'You are a rigorous content opportunity analyst for a Korean technology publication. Use only the supplied public evidence. Select one useful, non-spammy topic with genuine reader utility, implementation/comparison value, and an ethical monetization path. Reject YMYL, hype, thin listicles, and topics not supported by the supplied evidence.',
    input: `Date: ${today}\nNiche: ${config.content.niche}\nAudience: ${config.content.audience}\nDisallowed: ${config.content.disallowedTopics.join('; ')}\nRecent titles to avoid: ${JSON.stringify(recentTitles)}\n\nPUBLIC EVIDENCE:\n${evidenceForPrompt(discoveryDocs)}`
  });
  return data;
}

async function researchTopic(topic) {
  const queries = [
    topic.primaryKeyword,
    `${topic.primaryKeyword} official documentation`,
    `${topic.topic} implementation comparison`
  ];
  const documents = await collectEvidence(queries, researchOptions);
  if (documents.length < 3) throw new Error(`Research found only ${documents.length} usable public sources; refusing to publish.`);
  const sourceMap = allowedSourceMap(documents);
  const { data } = await ai({
    schema: researchSchema,
    instructions: 'Create a research brief using only the supplied evidence. Never invent URLs, claims, prices, dates, benchmarks, or personal experience. Every keyFact.sourceUrl must exactly match one of the supplied URLs. Prefer official/project documentation and first-party sources when available; use community sources mainly for context and caveats.',
    input: `Date: ${today}\nTopic: ${JSON.stringify(topic)}\nAudience: ${config.content.audience}\n\nPUBLIC EVIDENCE:\n${evidenceForPrompt(documents)}`
  });

  const validFacts = [];
  const factUrls = new Set();
  for (const fact of data.keyFacts || []) {
    const key = canonicalUrl(fact.sourceUrl);
    const allowed = sourceMap.get(key);
    if (!allowed) continue;
    factUrls.add(key);
    validFacts.push({ claim: fact.claim, sourceTitle: allowed.title, sourceUrl: allowed.url });
  }
  if (factUrls.size < 3) throw new Error(`Research brief cited only ${factUrls.size} whitelisted sources; refusing to continue.`);
  return { brief: { ...data, keyFacts: validFacts }, documents, sourceMap };
}

async function writeArticle(topic, research) {
  const { data } = await ai({
    schema: articleSchema,
    instructions: 'Write a Korean practitioner article grounded only in the supplied research brief. Add decision value through concrete steps, tradeoffs, limitations, operational concerns, and supported examples. Never claim personal experience. Do not invent facts. Avoid SEO filler. The slug must be lowercase ASCII with hyphens. Keep the article compact enough for a local 8B model: roughly 1200-1800 Korean words when the evidence supports that depth.',
    input: `Topic: ${JSON.stringify(topic)}\nResearch brief: ${JSON.stringify(research)}\nSources in the article must use URLs from the research brief only.`
  });
  return data;
}

async function qualityCheck(topic, researchBundle, article) {
  const { brief, documents, sourceMap } = researchBundle;
  const { data } = await ai({
    schema: qaSchema,
    instructions: 'Act as an independent senior editor and fact checker. Verify the draft against the supplied public evidence only. Remove unsupported claims, fake precision, stale-looking product details, weak explanations, SEO padding, and misleading monetization. Do not introduce new facts or URLs. verifiedSources URLs must exactly match supplied evidence. approved may be true only when the final article is factually defensible, genuinely useful, and safe.',
    input: `Date: ${today}\nMinimum passing score: ${config.content.minimumQualityScore}\nTopic: ${JSON.stringify(topic)}\nResearch brief: ${JSON.stringify(brief)}\nDraft: ${JSON.stringify(article)}\n\nPUBLIC EVIDENCE FOR VERIFICATION:\n${evidenceForPrompt(documents)}`
  });
  const verifiedSources = whitelistSources(data.verifiedSources, sourceMap);
  return { ...data, verifiedSources };
}

await mkdir(path.join(ROOT, 'public', 'posts'), { recursive: true });
await mkdir(path.join(ROOT, 'data', 'articles'), { recursive: true });

const topic = await chooseTopic();
if (duplicateKeyword(topic.primaryKeyword)) throw new Error(`Duplicate primary keyword: ${topic.primaryKeyword}`);
console.log(`Selected: ${topic.topic} (${topic.opportunityScore}/100)`);

const researchBundle = await researchTopic(topic);
console.log(`Collected ${researchBundle.documents.length} public evidence documents.`);
const article = await writeArticle(topic, researchBundle.brief);
const qa = await qualityCheck(topic, researchBundle, article);
console.log(`QA: ${qa.score}/100, approved=${qa.approved}, sources=${qa.verifiedSources.length}`);

if (!qa.approved || qa.score < config.content.minimumQualityScore) throw new Error(`Quality gate failed: ${qa.score}/100. ${(qa.warnings || []).join(' | ')}`);
if (qa.verifiedSources.length < 3) throw new Error('Quality review returned fewer than 3 whitelisted public sources.');
if (duplicateTitle(qa.revisedTitle)) throw new Error(`Duplicate article title: ${qa.revisedTitle}`);

let slug = slugify(article.slug || qa.revisedTitle);
if (!slug) slug = `article-${today}`;
if (posts.some((post) => post.slug === slug)) throw new Error(`Duplicate slug: ${slug}`);

const record = {
  title: qa.revisedTitle,
  slug,
  description: qa.revisedDescription,
  category: article.category,
  tags: article.tags,
  date: today,
  primaryKeyword: topic.primaryKeyword,
  opportunityScore: topic.opportunityScore,
  qualityScore: qa.score,
  verificationSummary: qa.verificationSummary,
  sources: qa.verifiedSources,
  model: modelConfig.model,
  researchMode: 'free-public-web'
};
const nextPosts = [record, ...posts];

await writeFile(path.join(ROOT, 'public', 'posts', `${slug}.html`), renderArticle({ config, article, qa, monetization, date: today, slug }));
await writeFile(path.join(ROOT, 'data', 'articles', `${slug}.json`), `${JSON.stringify({ topic, evidence: researchBundle.documents, research: researchBundle.brief, article, qa, model: modelConfig.model }, null, 2)}\n`);
await writeFile(path.join(ROOT, 'data', 'posts.json'), `${JSON.stringify(nextPosts, null, 2)}\n`);
await writeFile(path.join(ROOT, 'data', 'topic-queue.json'), `${JSON.stringify(queue, null, 2)}\n`);
await writeFile(path.join(ROOT, 'public', 'index.html'), renderIndex(config, nextPosts));
await writeFile(path.join(ROOT, 'public', 'feed.xml'), renderFeed(config, nextPosts));
await writeFile(path.join(ROOT, 'public', 'sitemap.xml'), renderSitemap(config, nextPosts));
await writeFile(path.join(ROOT, 'public', 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${config.site.baseUrl.replace(/\/$/, '')}/sitemap.xml\n`);
console.log(`Published ${qa.revisedTitle} -> public/posts/${slug}.html`);
