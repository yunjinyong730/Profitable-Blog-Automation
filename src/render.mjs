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
  const haystack = `${article.title} ${article.description} ${article.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...section.bullets]).join(' ')}`.toLowerCase();
  const matches = (monetization.affiliateLinks || []).filter((link) =>
    safeUrl(link.url) && (link.match || []).some((term) => haystack.includes(String(term).toLowerCase())));
  if (!matches.length) return '';
  return `<aside class="notice affiliate-box"><strong>관련 도구</strong><ul>${matches.map((link) =>
    `<li><a href="${esc(safeUrl(link.url))}" rel="sponsored nofollow noopener">${esc(link.label || link.url)}</a></li>`).join('')}</ul><small>${esc(monetization.affiliateDisclosure)}</small></aside>`;
}

function adHtml(monetization, useMidSlot = false, placement = 'article') {
  const client = monetization.adsense?.client || '';
  const slot = useMidSlot ? (monetization.adsense?.midSlot || monetization.adsense?.slot || '') : (monetization.adsense?.slot || '');
  if (!client || !slot) return '';
  return `<div class="ad-slot" data-ad-placement="${esc(placement)}"><div class="meta">광고</div><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(client)}" data-ad-slot="${esc(slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`;
}

function visualFigure(src, alt, caption) {
  if (!src) return '';
  return `<figure class="article-visual"><img src="../${esc(src)}" alt="${esc(alt)}" loading="lazy" width="1200"><figcaption>${esc(caption)}</figcaption></figure>`;
}

function commonsPhotoFigure(photo) {
  if (!photo?.localPath) return '';
  const source = safeUrl(photo.sourcePageUrl);
  const original = safeUrl(photo.originalFileUrl);
  const licenseUrl = safeUrl(photo.licenseUrl);
  const description = photo.description || photo.title || 'Wikimedia Commons 이미지';
  const author = photo.author || '저자 정보는 원본 페이지 참조';
  const license = photo.license || '라이선스는 원본 페이지 참조';
  const licenseHtml = licenseUrl
    ? `<a href="${esc(licenseUrl)}" rel="license noopener noreferrer">${esc(license)}</a>`
    : esc(license);
  const sourceHtml = source
    ? `<a href="${esc(source)}" rel="noopener noreferrer">Wikimedia Commons 원본 페이지</a>`
    : 'Wikimedia Commons';
  const originalHtml = original
    ? ` · <a href="${esc(original)}" rel="noopener noreferrer">원본 파일</a>`
    : '';
  return `<figure class="article-visual licensed-photo"><img src="../${esc(photo.localPath)}" alt="${esc(description)}" loading="lazy"><figcaption><span>${esc(description)}</span><br><span class="photo-credit">사진: ${esc(author)} · ${licenseHtml} · ${sourceHtml}${originalHtml}</span></figcaption></figure>`;
}

function audienceLabel(config, id) {
  return config.research?.audienceSegments?.find((segment) => segment.id === id)?.label || (id === 'general' ? '일반 독자' : id || '일반 독자');
}

function roleLabel(role) {
  return ({ reach: '실용 가이드', commercial: '도구 선택', authority: '심화 가이드' })[role] || '가이드';
}

function adCount(config, role) {
  const policy = config.monetization?.adsensePolicy || {};
  if (role === 'reach') return policy.reachPlacements ?? 2;
  if (role === 'commercial') return policy.commercialPlacements ?? 1;
  if (role === 'authority') return policy.authorityPlacements ?? 1;
  return 1;
}

function insertAdsenseBlocks({ config, topic, monetization, blocks }) {
  const count = adCount(config, topic?.contentRole);
  const hasAdsense = Boolean(monetization.adsense?.client && monetization.adsense?.slot);
  if (!hasAdsense || count <= 0) return { blocks, topAd: '' };

  const next = [...blocks];
  if (topic?.contentRole === 'reach') {
    const topAd = adHtml(monetization, false, 'after-cover');
    if (count > 1) {
      const index = Math.min(Math.max(3, Math.floor(next.length * 0.55)), next.length);
      next.splice(index, 0, adHtml(monetization, true, 'mid-article'));
    }
    return { blocks: next, topAd };
  }

  const index = topic?.contentRole === 'commercial'
    ? Math.min(2, next.length)
    : Math.min(Math.max(3, Math.floor(next.length * 0.6)), next.length);
  next.splice(index, 0, adHtml(monetization, true, topic?.contentRole === 'commercial' ? 'commercial-mid' : 'authority-mid'));
  return { blocks: next, topAd: '' };
}

export function renderArticle({ config, topic, article, qa, monetization, date, slug, visuals, commonsPhoto }) {
  const base = config.site.baseUrl.replace(/\/$/, '');
  const url = `${base}/posts/${slug}.html`;
  const coverUrl = visuals?.cover ? `${base}/${visuals.cover}` : '';
  const mediaUrl = commonsPhoto?.localPath ? `${base}/${commonsPhoto.localPath}` : '';
  const sources = (qa.verifiedSources || []).map((source) => ({ ...source, url: safeUrl(source.url) })).filter((source) => source.url);
  const targetAudience = audienceLabel(config, topic?.audienceSegment);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: qa.revisedTitle,
    description: qa.revisedDescription,
    datePublished: date,
    dateModified: date,
    author: { '@type': 'Person', name: config.site.author },
    audience: { '@type': 'Audience', audienceType: targetAudience },
    mainEntityOfPage: url,
    ...(coverUrl ? { image: coverUrl } : {})
  };
  if (commonsPhoto && mediaUrl) {
    schema.associatedMedia = {
      '@type': 'ImageObject',
      contentUrl: mediaUrl,
      creditText: commonsPhoto.author,
      ...(safeUrl(commonsPhoto.licenseUrl) ? { license: safeUrl(commonsPhoto.licenseUrl) } : {}),
      ...(safeUrl(commonsPhoto.sourcePageUrl) ? { acquireLicensePage: safeUrl(commonsPhoto.sourcePageUrl) } : {})
    };
  }
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.revisedFaq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer }
    }))
  };
  const hasAdsense = Boolean(monetization.adsense?.client && monetization.adsense?.slot);
  const adsenseScript = hasAdsense
    ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(monetization.adsense.client)}" crossorigin="anonymous"></script>`
    : '';

  const blocks = qa.revisedSections.map(sectionHtml);
  if (commonsPhoto && blocks.length > 1) blocks.splice(1, 0, commonsPhotoFigure(commonsPhoto));
  if (visuals?.summary && blocks.length > 3) {
    blocks.splice(3, 0, visualFigure(visuals.summary, `${qa.revisedTitle} 핵심 요약 인포그래픽`, '본문의 검증된 핵심 내용을 자동으로 시각화한 요약 자료입니다.'));
  }
  const adLayout = insertAdsenseBlocks({ config, topic, monetization, blocks });
  const cover = visualFigure(visuals?.cover, `${qa.revisedTitle} 커버 이미지`, '글의 최종 내용을 바탕으로 자체 생성한 커버입니다.');
  const ogImage = coverUrl ? `<meta property="og:image" content="${esc(coverUrl)}">` : '';
  const meta = `${date} · ${article.category} · ${targetAudience} · ${roleLabel(topic?.contentRole)} · Quality ${qa.score}/100`;

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(qa.revisedTitle)} | ${esc(config.site.name)}</title><meta name="description" content="${esc(qa.revisedDescription)}"><link rel="canonical" href="${esc(url)}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(qa.revisedTitle)}"><meta property="og:description" content="${esc(qa.revisedDescription)}"><meta property="og:url" content="${esc(url)}">${ogImage}<link rel="stylesheet" href="../styles.css">${adsenseScript}<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script><script type="application/ld+json">${JSON.stringify(faqSchema).replace(/</g, '\\u003c')}</script></head><body><header><a class="brand" href="../">${esc(config.site.name)}</a><nav><a href="../">Articles</a><a href="../feed.xml">RSS</a><a href="../disclosure.html">Disclosure</a></nav></header><main><article><p class="meta">${esc(meta)}</p><h1>${esc(qa.revisedTitle)}</h1><p class="lede">${esc(qa.revisedDescription)}</p>${cover}${adLayout.topAd}${adLayout.blocks.join('')}${affiliateHtml({ ...article, title: qa.revisedTitle, description: qa.revisedDescription, sections: qa.revisedSections }, monetization)}<section><h2>자주 묻는 질문</h2>${qa.revisedFaq.map((item) => `<h3>${esc(item.question)}</h3><p>${esc(item.answer)}</p>`).join('')}</section><section><h2>출처</h2><ol class="sources">${sources.map((source) => `<li><a href="${esc(source.url)}" rel="noopener noreferrer">${esc(source.title)}</a></li>`).join('')}</ol></section><p class="notice">이 글은 공개 웹 자료를 바탕으로 자동 리서치·작성 후 독립적인 사실검증 단계를 통과했습니다. Wikimedia Commons 사진이 포함된 경우 각 이미지 아래에 저자·라이선스·원본 링크를 별도로 표시합니다. 중요한 의사결정은 연결된 원문 출처를 함께 확인하세요.</p></article></main><footer>© ${esc(config.site.author)} · <a href="../privacy.html">Privacy</a> · <a href="../disclosure.html">Disclosure</a></footer></body></html>`;
}

export function renderIndex(config, posts) {
  const cards = posts.slice(0, config.content.maxPostsOnIndex).map((post) => {
    const cover = post.visuals?.cover ? `<img class="card-cover" src="./${esc(post.visuals.cover)}" alt="" loading="lazy">` : '';
    const audience = post.audienceSegment ? ` · ${audienceLabel(config, post.audienceSegment)}` : '';
    return `<a class="card" href="./posts/${esc(post.slug)}.html">${cover}<div class="meta">${esc(post.date)} · ${esc(post.category)}${esc(audience)}</div><h2>${esc(post.title)}</h2><p>${esc(post.description)}</p><div>${(post.tags || []).map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}</div></a>`;
  }).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(config.site.name)}</title><meta name="description" content="${esc(config.site.description)}"><link rel="canonical" href="${esc(config.site.baseUrl)}"><link rel="alternate" type="application/rss+xml" href="${esc(config.site.baseUrl.replace(/\/$/, ''))}/feed.xml"><link rel="stylesheet" href="./styles.css"></head><body><header><a class="brand" href="./">${esc(config.site.name)}</a><nav><a href="./feed.xml">RSS</a><a href="./disclosure.html">Disclosure</a><a href="./privacy.html">Privacy</a></nav></header><main><section class="hero"><p class="eyebrow">Work · Small Business · Freelance · Creator · Developer</p><h1>${esc(config.site.name)}</h1><p class="lede">${esc(config.site.description)}</p></section><section class="grid">${cards || '<p>첫 번째 글을 준비 중입니다.</p>'}</section></main><footer>© ${esc(config.site.author)} · <a href="./privacy.html">Privacy</a> · <a href="./disclosure.html">Disclosure</a></footer></body></html>`;
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
  const urls = [base, `${base}/privacy.html`, `${base}/disclosure.html`, ...posts.map((post) => `${base}/posts/${post.slug}.html`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${xml(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
}
