import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile('config/blog.config.json', 'utf8'));
const posts = JSON.parse(await readFile('data/posts.json', 'utf8'));
const queue = JSON.parse(await readFile('data/topic-queue.json', 'utf8'));

if (!config.site?.baseUrl?.startsWith('https://')) throw new Error('config.site.baseUrl must use HTTPS.');
if (!config.openai?.model) throw new Error('config.openai.model is required.');
if (!Number.isInteger(config.content?.minimumQualityScore) || config.content.minimumQualityScore < 70) throw new Error('minimumQualityScore must be an integer >= 70.');
if (!Array.isArray(posts)) throw new Error('data/posts.json must contain an array.');
if (!Array.isArray(queue)) throw new Error('data/topic-queue.json must contain an array.');

const slugs = new Set();
for (const post of posts) {
  if (!post.slug || slugs.has(post.slug)) throw new Error(`Invalid/duplicate post slug: ${post.slug}`);
  slugs.add(post.slug);
}
console.log('Configuration and data files are valid.');
