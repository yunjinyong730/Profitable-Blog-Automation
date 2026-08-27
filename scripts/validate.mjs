import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile('config/blog.config.json', 'utf8'));
const posts = JSON.parse(await readFile('data/posts.json', 'utf8'));
const queue = JSON.parse(await readFile('data/topic-queue.json', 'utf8'));

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

if (!config.site?.baseUrl?.startsWith('https://')) throw new Error('config.site.baseUrl must use HTTPS.');
if (config.localModel?.provider !== 'ollama') throw new Error('config.localModel.provider must be ollama.');
if (!String(config.localModel?.baseUrl || '').startsWith('http://127.0.0.1:')) throw new Error('config.localModel.baseUrl must point to local loopback Ollama.');
const requiredStages = ['topic', 'research', 'draft', 'qa'];
const stageModels = requiredStages.map((name) => {
  const stage = config.localModel?.stages?.[name];
  if (!stage?.model) throw new Error(`localModel.stages.${name}.model is required.`);
  if (String(stage.model).includes('cloud')) throw new Error(`Cloud Ollama model is forbidden in zero-cost mode: ${stage.model}`);
  if (!Number.isInteger(stage.contextWindow) || stage.contextWindow < 2048) throw new Error(`${name}.contextWindow is invalid.`);
  return stage.model;
});
if (new Set(stageModels).size !== stageModels.length) throw new Error('Each pipeline stage must use a distinct model.');
if (!Number.isInteger(config.content?.minimumQualityScore) || config.content.minimumQualityScore < 80 || config.content.minimumQualityScore > 100) throw new Error('minimumQualityScore must be an integer from 80 to 100.');
if (!Array.isArray(config.research?.topicPillars) || config.research.topicPillars.length < 6) throw new Error('research.topicPillars must contain at least 6 pillars.');
if (!Array.isArray(config.research?.intentTemplates) || config.research.intentTemplates.length < 6) throw new Error('research.intentTemplates must contain at least 6 templates.');
if (!config.publishing?.timezone) throw new Error('config.publishing.timezone is required.');
if (config.visuals?.commonsPhotos?.enabled) {
  const commons = config.visuals.commonsPhotos;
  if (!Array.isArray(commons.allowedLicenseFamilies) || commons.allowedLicenseFamilies.length < 2) throw new Error('visuals.commonsPhotos.allowedLicenseFamilies must define reusable license families.');
  const forbidden = commons.allowedLicenseFamilies.some((license) => /\bNC\b|\bND\b|noncommercial|no derivatives/i.test(String(license)));
  if (forbidden) throw new Error('Non-commercial or no-derivatives Commons licenses are forbidden for this monetized blog.');
  if (!Number.isInteger(commons.thumbWidth) || commons.thumbWidth < 800 || commons.thumbWidth > 2000) throw new Error('visuals.commonsPhotos.thumbWidth must be 800-2000.');
  if (!Number.isInteger(commons.maxBytes) || commons.maxBytes < 500000 || commons.maxBytes > 8000000) throw new Error('visuals.commonsPhotos.maxBytes is invalid.');
}
if (!Array.isArray(posts)) throw new Error('data/posts.json must contain an array.');
if (!Array.isArray(queue)) throw new Error('data/topic-queue.json must contain an array.');

const slugs = new Set();
const titles = new Set();
const keywords = new Set();
for (const post of posts) {
  if (!post.slug || slugs.has(post.slug)) throw new Error(`Invalid/duplicate post slug: ${post.slug}`);
  slugs.add(post.slug);
  const title = String(post.title || '').trim().toLowerCase();
  if (!title || titles.has(title)) throw new Error(`Invalid/duplicate post title: ${post.title}`);
  titles.add(title);
  const keyword = String(post.primaryKeyword || '').trim().toLowerCase();
  if (!keyword || keywords.has(keyword)) throw new Error(`Invalid/duplicate primary keyword: ${post.primaryKeyword}`);
  keywords.add(keyword);
  const urls = new Set((post.sources || []).filter((source) => validHttpUrl(source.url)).map((source) => source.url));
  if (urls.size < 3) throw new Error(`Post ${post.slug} must contain at least 3 unique valid source URLs.`);
  if (post.media) {
    if (post.media.provider !== 'Wikimedia Commons') throw new Error(`Unsupported media provider for ${post.slug}.`);
    if (!String(post.media.localPath || '').startsWith('assets/posts/')) throw new Error(`Invalid local media path for ${post.slug}.`);
    if (!validHttpUrl(post.media.sourcePageUrl)) throw new Error(`Invalid media source page for ${post.slug}.`);
    if (!post.media.license || !post.media.author) throw new Error(`Missing media attribution for ${post.slug}.`);
  }
}
console.log(`Configuration valid: ${stageModels.join(' -> ')}; Commons licensing guard enabled; ${posts.length} posts, ${queue.length} queued topics.`);
