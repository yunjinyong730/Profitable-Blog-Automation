import net from 'node:net';

const UA = 'ProfitableBlogAutomation/1.0 (+https://github.com/yunjinyong730/Profitable-Blog-Automation)';

function decodeHtml(value = '') {
  return String(value)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
}

function stripHtml(html = '') {
  return decodeHtml(String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}

function isPrivateIpv4(ip) {
  const parts = ip.split('.').map(Number);
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || parts[0] === 0;
}

export function safePublicUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return '';
    if (net.isIP(host) === 4 && isPrivateIpv4(host)) return '';
    if (net.isIP(host) === 6 && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80'))) return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

export function canonicalUrl(value) {
  const safe = safePublicUrl(value);
  if (!safe) return '';
  const url = new URL(safe);
  url.hash = '';
  url.searchParams.sort();
  const text = url.toString();
  return text.endsWith('/') ? text.slice(0, -1) : text;
}

async function fetchWithTimeout(url, { timeoutMs = 15000, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: { 'User-Agent': UA, ...headers }, redirect: 'follow', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function ddgTarget(raw) {
  try {
    const url = new URL(decodeHtml(raw), 'https://duckduckgo.com');
    const uddg = url.searchParams.get('uddg');
    return safePublicUrl(uddg ? decodeURIComponent(uddg) : url.toString());
  } catch {
    return '';
  }
}

async function searchDuckDuckGo(query, limit, timeoutMs) {
  const response = await fetchWithTimeout(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    timeoutMs,
    headers: { Accept: 'text/html,application/xhtml+xml' }
  });
  if (!response.ok) throw new Error(`DuckDuckGo search ${response.status}`);
  const html = await response.text();
  const results = [];
  const anchorRe = /<a\b([^>]*class=["'][^"']*result__a[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorRe)) {
    const href = match[1].match(/href=["']([^"']+)["']/i)?.[1] || '';
    const url = ddgTarget(href);
    if (!url) continue;
    results.push({ title: stripHtml(match[2]), url, snippet: '', provider: 'duckduckgo', query });
    if (results.length >= limit) break;
  }
  return results;
}

async function searchGitHub(query, limit, timeoutMs) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${limit}`;
  const response = await fetchWithTimeout(url, { timeoutMs, headers });
  if (!response.ok) throw new Error(`GitHub search ${response.status}`);
  const payload = await response.json();
  return (payload.items || []).slice(0, limit).map((item) => ({
    title: item.full_name,
    url: safePublicUrl(item.html_url),
    snippet: item.description || '',
    provider: 'github',
    query
  })).filter((item) => item.url);
}

async function searchHackerNews(query, limit, timeoutMs) {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${limit}`;
  const response = await fetchWithTimeout(url, { timeoutMs, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Hacker News search ${response.status}`);
  const payload = await response.json();
  return (payload.hits || []).slice(0, limit).map((hit) => ({
    title: hit.title || 'Hacker News discussion',
    url: safePublicUrl(hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`),
    snippet: hit.story_text || '',
    provider: 'hackernews',
    query
  })).filter((item) => item.url);
}

async function pageDocument(candidate, maxChars, timeoutMs) {
  try {
    const response = await fetchWithTimeout(candidate.url, { timeoutMs, headers: { Accept: 'text/html,text/plain,application/json;q=0.8' } });
    if (!response.ok) return null;
    const type = response.headers.get('content-type') || '';
    if (!/(text|html|json|xml)/i.test(type)) return null;
    const raw = (await response.text()).slice(0, 250000);
    const title = stripHtml(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || candidate.title).slice(0, 240);
    const text = stripHtml(raw).slice(0, maxChars);
    if (text.length < 180) return { ...candidate, title: title || candidate.title, text: candidate.snippet || '' };
    return { ...candidate, title: title || candidate.title, text };
  } catch {
    return candidate.snippet ? { ...candidate, text: candidate.snippet.slice(0, maxChars) } : null;
  }
}

export async function collectEvidence(queries, options = {}) {
  const uniqueQueries = [...new Set((queries || []).map((q) => String(q).trim()).filter(Boolean))].slice(0, options.maxQueries || 4);
  const perProvider = options.maxSearchResultsPerQuery || 4;
  const timeoutMs = options.requestTimeoutMs || 15000;
  const candidates = [];
  for (const query of uniqueQueries) {
    const groups = await Promise.allSettled([
      searchDuckDuckGo(query, perProvider, timeoutMs),
      searchGitHub(query, Math.min(3, perProvider), timeoutMs),
      searchHackerNews(query, Math.min(3, perProvider), timeoutMs)
    ]);
    for (const group of groups) if (group.status === 'fulfilled') candidates.push(...group.value);
  }

  const seen = new Set();
  const deduped = [];
  for (const item of candidates) {
    const key = canonicalUrl(item.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...item, url: safePublicUrl(item.url) });
  }

  const maxDocuments = options.maxDocuments || 6;
  const docs = [];
  for (const candidate of deduped) {
    if (docs.length >= maxDocuments) break;
    const doc = await pageDocument(candidate, options.maxCharsPerDocument || 2200, timeoutMs);
    if (doc?.url && (doc.text || doc.snippet)) docs.push(doc);
  }
  return docs;
}

export function evidenceForPrompt(documents) {
  return documents.map((doc, index) => `[S${index + 1}] ${doc.title}\nURL: ${doc.url}\nProvider: ${doc.provider}\nEvidence: ${(doc.text || doc.snippet || '').slice(0, 2400)}`).join('\n\n');
}

export function allowedSourceMap(documents) {
  const map = new Map();
  for (const doc of documents) map.set(canonicalUrl(doc.url), { title: doc.title, url: safePublicUrl(doc.url) });
  return map;
}
