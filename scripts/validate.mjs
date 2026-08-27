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
if (!config.openai?.model) throw new Error('config.openai.model is required.');
if (!Number.isInteger(config.content?.minimumQualityScore) || config.content.minimumQualityScore < 70 || config.content.minimumQualityScore > 100) throw new Error('minimumQualityScore must be an integer from 70 to 100.');
if (!config.publishing?.timezone) throw new Error('config.publishing.timezone is required.');
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
}
console.log(`Configuration and data files are valid (${posts.length} posts, ${queue.length} queued topics).`);
