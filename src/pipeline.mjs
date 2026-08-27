import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { structuredResponse } from './openai.mjs';
import { renderArticle, renderFeed, renderIndex, renderSitemap, safeUrl } from './render.mjs';

const ROOT = process.cwd();
const readJson = async (relative) => JSON.parse(await readFile(path.join(ROOT, relative), 'utf8'));
const config = await readJson('config/blog.config.json');
const posts = await readJson('data/posts.json');
const queue = await readJson('data/topic-queue.json');
const apiKey = process.env.OPENAI_API_KEY;
const timezone = config.publishing?.timezone || 'Asia/Seoul';
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone,
  year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());
const manualTopic = (process.env.BLOG_TOPIC || '').trim();

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
    keyFacts: { type: 'array', minItems: 4, maxItems: 14, items: { type: 'object', additionalProperties: false, properties: {
      claim: { type: 'string' }, sourceTitle: { type: 'string' }, sourceUrl: { type: 'string' }
    }, required: ['claim', 'sourceTitle', 'sourceUrl'] } },
    readerQuestions: { type: 'array', minItems: 3, maxItems: 10, items: { type: 'string' } },
    contentGap: { type: 'string' }, monetizationFit: { type: 'string' },
    caveats: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string' } }
  },
  required: ['thesis', 'keyFacts', 'readerQuestions', 'contentGap', 'monetizationFit', 'caveats']
};

const sectionSchema = { type: 'object', additionalProperties: false, properties: {
  heading: { type: 'string' },
  paragraphs: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string' } },
  bullets: { type: 'array', maxItems: 10, items: { type: 'string' } }
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
  sections: { type: 'array', minItems: 5, maxItems: 12, items: sectionSchema },
  faq: { type: 'array', minItems: 2, maxItems: 6, items: faqItemSchema },
  sources: { type: 'array', minItems: 3, maxItems: 14, items: sourceSchema },
  affiliateOpportunities: { type: 'array', maxItems: 6, items: { type: 'string' } }
}, required: ['title', 'slug', 'description', 'category', 'tags', 'sections', 'faq', 'sources', 'affiliateOpportunities'] };

const qaSchema = { type: 'object', additionalProperties: false, properties: {
  score: { type: 'integer', minimum: 0, maximum: 100 }, approved: { type: 'boolean' },
  revisedTitle: { type: 'string' }, revisedDescription: { type: 'string' },
  revisedSections: { type: 'array', minItems: 5, maxItems: 12, items: sectionSchema },
  revisedFaq: { type: 'array', minItems: 2, maxItems: 6, items: faqItemSchema },
  verifiedSources: { type: 'array', minItems: 3, maxItems: 14, items: sourceSchema },
  warnings: { type: 'array', maxItems: 12, items: { type: 'string' } },
  verificationSummary: { type: 'string' }
}, required: ['score', 'approved', 'revisedTitle', 'revisedDescription', 'revisedSections', 'revisedFaq', 'verifiedSources', 'warnings', 'verificationSummary'] };

const ai = (args) => structuredResponse({ apiKey, model: config.openai.model, reasoningEffort: config.openai.reasoningEffort, maxOutputTokens: config.openai.maxOutputTokens, searchContextSize: config.openai.searchContextSize, ...args });

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
function uniqueValidSources(sources) {
  const seen = new Set();
  const result = [];
  for (const source of sources || []) {
    const url = safeUrl(source.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push({ ...source, url });
  }
  return result;
}

async function chooseTopic() {
  if (manualTopic) return { topic: manualTopic, primaryKeyword: manualTopic, searchIntent: 'manual', monetizationAngle: 'manual', whyNow: 'manual workflow dispatch', opportunityScore: 100 };
  if (queue.length) {
    const queued = queue.shift();
    if (typeof queued === 'string') return { topic: queued, primaryKeyword: queued, searchIntent: 'queued', monetizationAngle: 'queued', whyNow: 'topic queue', opportunityScore: 100 };
    return queued;
  }
  const recentTitles = posts.slice(0, config.content.recentTitleWindow).map((post) => post.title);
  const { data } = await ai({ name: 'topic_opportunity', schema: topicSchema, webSearch: true, instructions: 'You are a rigorous content opportunity analyst. Select one useful, non-spammy topic for a Korean technology publication. Prioritize genuine reader utility, current search intent, implementation or comparison value, and ethical monetization potential. Reject YMYL, hype, thin listicles, and topics that merely restate existing search results.', input: `Date: ${today}\nNiche: ${config.content.niche}\nAudience: ${config.content.audience}\nDisallowed: ${config.content.disallowedTopics.join('; ')}\nRecent titles to avoid: ${JSON.stringify(recentTitles)}\nUse current web search evidence and return one strong opportunity.` });
  return data;
}

async function researchTopic(topic) {
  const { data } = await ai({ name: 'research_brief', schema: researchSchema, webSearch: true, instructions: 'Research the topic using current, reputable sources. Prefer official documentation, original research, standards bodies, government sources, and first-party product documentation. Do not invent claims, prices, dates, benchmarks, or experience. Focus on facts that materially help a practitioner make a decision.', input: `Date: ${today}\nTopic: ${JSON.stringify(topic)}\nAudience: ${config.content.audience}\nCreate a research brief with source URLs for every key fact and identify a content gap this article can genuinely fill.` });
  data.keyFacts = data.keyFacts.map((fact) => ({ ...fact, sourceUrl: safeUrl(fact.sourceUrl) })).filter((fact) => fact.sourceUrl);
  const uniqueResearchUrls = new Set(data.keyFacts.map((fact) => fact.sourceUrl));
  if (uniqueResearchUrls.size < 3) throw new Error('Research did not return at least 3 unique valid HTTP(S) sources.');
  return data;
}

async function writeArticle(topic, research) {
  const { data } = await ai({ name: 'article_draft', schema: articleSchema, webSearch: false, instructions: 'Write a Korean long-form practitioner article grounded only in the supplied research brief. Add decision value: concrete steps, tradeoffs, limitations, operational concerns, and examples where supported. Never claim personal experience. Do not invent facts. Keep paragraphs readable and avoid SEO filler. The slug must be lowercase ASCII with hyphens.', input: `Topic: ${JSON.stringify(topic)}\nResearch brief: ${JSON.stringify(research)}\nTarget: roughly 1800-2800 Korean words when justified by the subject. Build 5-12 coherent sections and 2-6 FAQs. Sources must come from the research brief.` });
  return data;
}

async function qualityCheck(topic, research, article) {
  const { data } = await ai({ name: 'quality_review', schema: qaSchema, webSearch: true, instructions: 'Act as an independent senior editor and fact checker. Re-check time-sensitive or consequential claims with web search. Correct unsupported claims, fake precision, stale product details, weak explanations, SEO padding, and misleading monetization. Preserve useful depth. approved may be true only if the final article is factually defensible, genuinely useful, and safe. verifiedSources must include only reputable HTTP(S) sources you actually used to verify the final content.', input: `Date: ${today}\nMinimum passing score: ${config.content.minimumQualityScore}\nTopic: ${JSON.stringify(topic)}\nResearch: ${JSON.stringify(research)}\nDraft: ${JSON.stringify(article)}` });
  data.verifiedSources = uniqueValidSources(data.verifiedSources);
  return data;
}

await mkdir(path.join(ROOT, 'public', 'posts'), { recursive: true });
await mkdir(path.join(ROOT, 'data', 'articles'), { recursive: true });
const topic = await chooseTopic();
if (duplicateKeyword(topic.primaryKeyword)) throw new Error(`Duplicate primary keyword: ${topic.primaryKeyword}`);
console.log(`Selected: ${topic.topic} (${topic.opportunityScore}/100)`);
const research = await researchTopic(topic);
const article = await writeArticle(topic, research);
const qa = await qualityCheck(topic, research, article);
console.log(`QA: ${qa.score}/100, approved=${qa.approved}`);
if (!qa.approved || qa.score < config.content.minimumQualityScore) throw new Error(`Quality gate failed: ${qa.score}/100. ${qa.warnings.join(' | ')}`);
if (qa.verifiedSources.length < 3) throw new Error('Quality review returned fewer than 3 unique valid sources.');
if (duplicateTitle(qa.revisedTitle)) throw new Error(`Duplicate article title: ${qa.revisedTitle}`);
let slug = slugify(article.slug || qa.revisedTitle);
if (!slug) slug = `article-${today}`;
if (posts.some((post) => post.slug === slug)) throw new Error(`Duplicate slug: ${slug}`);
const record = { title: qa.revisedTitle, slug, description: qa.revisedDescription, category: article.category, tags: article.tags, date: today, primaryKeyword: topic.primaryKeyword, opportunityScore: topic.opportunityScore, qualityScore: qa.score, verificationSummary: qa.verificationSummary, sources: qa.verifiedSources };
const nextPosts = [record, ...posts];
await writeFile(path.join(ROOT, 'public', 'posts', `${slug}.html`), renderArticle({ config, article, qa, monetization, date: today, slug }));
await writeFile(path.join(ROOT, 'data', 'articles', `${slug}.json`), `${JSON.stringify({ topic, research, article, qa }, null, 2)}\n`);
await writeFile(path.join(ROOT, 'data', 'posts.json'), `${JSON.stringify(nextPosts, null, 2)}\n`);
await writeFile(path.join(ROOT, 'data', 'topic-queue.json'), `${JSON.stringify(queue, null, 2)}\n`);
await writeFile(path.join(ROOT, 'public', 'index.html'), renderIndex(config, nextPosts));
await writeFile(path.join(ROOT, 'public', 'feed.xml'), renderFeed(config, nextPosts));
await writeFile(path.join(ROOT, 'public', 'sitemap.xml'), renderSitemap(config, nextPosts));
await writeFile(path.join(ROOT, 'public', 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${config.site.baseUrl.replace(/\/$/, '')}/sitemap.xml\n`);
console.log(`Published ${qa.revisedTitle} -> public/posts/${slug}.html`);
