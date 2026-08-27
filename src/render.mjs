export const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

export function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function sectionHtml(section) {
  const paragraphs = (section.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join('');
  const bullets = (section.bullets || []).length
    ? `<ul>${section.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
    : '';
  return `<section><h2>${esc(section.heading)}</h2>${paragraphs}${bullets}</section>`;
}

function affiliateHtml(article, monetization) {
  const haystack = `${article.title} ${article.description} ${article.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...s.bullets]).join(' ')}`.toLowerCase();
  const matches = (monetization.affiliateLinks || []).filter((link) => {
    if (!safeUrl(link.url)) return false;
    return (link.match || []).some((term) => haystack.includes(String(term).toLowerCase()));
  });
  if (!matches.length) return '';
  return `<aside class="notice"><strong>관련 도구</strong><ul>${matches.map((link) => `<li><a href="${esc(safeUrl(link.url))}" rel="sponsored nofollow noopener">${esc(link.label)}</a></li>`).join('')}</ul><small>${esc(monetization.affiliateDisclosure)}</small></aside>`;
}

function adHtml(monetization) {
  const client = monetization.adsense?.client || '';
  const slot = monetization.adsense?.slot || '';
  if (!client || !slot) return '';
  return `<div class="ad-slot"><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(client)}" data-ad-slot="${esc(slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins></div>`;
}

export function renderArticle({ config, article, qa, monetization, date, slug }) {
  const base = config.site.baseUrl.replace(/\/$/, '');
  const url = `${base}/posts/${slug}.html`;
  const sources = (qa.verifiedSources || []).map((s) => ({ ...s, url: safeUrl(s.url) })).filter((s) => s.url);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: qa.revisedTitle,
    description: qa.revisedDescription,
    datePublished: date,
    dateModified: date,
    author: { '@type': 'Person', name: config.site.author },
    mainEntityOfPage: url
  };
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.revisedFaq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer }
    }))
  };
  const adsenseScript = monetization.adsense?.client
    ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(monetization.adsense.client)}" crossorigin="anonymous"></script><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>`
    : '';

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(qa.revisedTitle)} | ${esc(config.site.name)}</title><meta name="description" content="${esc(qa.revisedDescription)}"><link rel="canonical" href="${esc(url)}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(qa.revisedTitle)}"><meta property="og:description" content="${esc(qa.revisedDescription)}"><meta property="og:url" content="${esc(url)}"><link rel="stylesheet" href="../styles.css"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script><script type="application/ld+json">${JSON.stringify(faqSchema).replace(/</g, '\\u003c')}</script></head><body><header><a class="brand" href="../">${esc(config.site.name)}</a><nav><a href="../">Articles</a><a href="../feed.xml">RSS</a></nav></header><main><article><p class="meta">${date} · ${esc(article.category)} · Quality ${qa.score}/100</p><h1>${esc(qa.revisedTitle)}</h1><p class="lede">${esc(qa.revisedDescription)}</p>${adHtml(monetization)}${qa.revisedSections.map(sectionHtml).join('')}${affiliateHtml({ ...article, title: qa.revisedTitle, description: qa.revisedDescription, sections: qa.revisedSections }, monetization)}<section><h2>자주 묻는 질문</h2>${qa.revisedFaq.map((item) => `<h3>${esc(item.question)}</h3><p>${esc(item.answer)}</p>`).join('')}</section><section><h2>출처</h2><ol class="sources">${sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener noreferrer">${esc(s.title)}</a></li>`).join('')}</ol></section><p class="notice">이 글은 자동 리서치·작성 후 독립적인 사실검증 단계를 통과한 콘텐츠입니다. 중요한 의사결정은 연결된 원문 출처를 함께 확인하세요.</p></article></main><footer>© ${esc(config.site.author)}</footer>${adsenseScript}</body></html>`;
}

export function renderIndex(config, posts) {
  const cards = posts.slice(0, config.content.maxPostsOnIndex).map((post) => `<a class="card" href="./posts/${esc(post.slug)}.html"><div class="meta">${esc(post.date)} · ${esc(post.category)}</div><h2>${esc(post.title)}</h2><p>${esc(post.description)}</p><div>${(post.tags || []).map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}</div></a>`).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(config.site.name)}</title><meta name="description" content="${esc(config.site.description)}"><link rel="canonical" href="${esc(config.site.baseUrl)}"><link rel="stylesheet" href="./styles.css"></head><body><header><a class="brand" href="./">${esc(config.site.name)}</a><nav><a href="./feed.xml">RSS</a></nav></header><main><section class="hero"><p class="eyebrow">Research → Draft → Verify → Publish</p><h1>${esc(config.site.name)}</h1><p class="lede">${esc(config.site.description)}</p></section><section class="grid">${cards || '<p>첫 번째 글을 준비 중입니다.</p>'}</section></main><footer>© ${esc(config.site.author)}</footer></body></html>`;
}

export function renderFeed(config, posts) {
  const xml = esc;
  const base = config.site.baseUrl.replace(/\/$/, '');
  const items = posts.slice(0, 20).map((post) => `<item><title>${xml(post.title)}</title><link>${xml(`${base}/posts/${post.slug}.html`)}</link><guid>${xml(`${base}/posts/${post.slug}.html`)}</guid><pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate><description>${xml(post.description)}</description></item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(config.site.name)}</title><link>${xml(base)}</link><description>${xml(config.site.description)}</description><language>ko-kr</language>${items}</channel></rss>\n`;
}

export function renderSitemap(config, posts) {
  const xml = esc;
  const base = config.site.baseUrl.replace(/\/$/, '');
  const urls = [base, ...posts.map((post) => `${base}/posts/${post.slug}.html`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${xml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
}
