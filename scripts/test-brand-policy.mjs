import { readFile, stat } from 'node:fs/promises';

const html = await readFile('public/index.html', 'utf8');
const css = await readFile('public/brand.css', 'utf8');
const banner = await stat('public/assets/brand/hero-banner.avif');

for (const required of [
  'data-brand-patched="v4"',
  'class="brand-banner-image"',
  'src="./assets/brand/hero-banner.avif"',
  'width="800" height="267"',
  'href="./brand.css"',
  'data-audience-icon="knowledge-worker"',
  'data-audience-icon="small-business"',
  'data-audience-icon="freelancer"',
  'data-audience-icon="creator"',
  'data-audience-icon="developer"'
]) {
  if (!html.includes(required)) throw new Error(`Brand patch missing ${required}`);
}

if (banner.size < 8_000) throw new Error(`Generated banner asset looks unexpectedly small (${banner.size} bytes).`);
if (html.includes('class="brand-banner-art"')) throw new Error('Legacy inline SVG hero art should be replaced by the generated banner image.');
if (html.includes('data:image/png;base64,')) throw new Error('Homepage banner must use a repository asset, not a base64 payload.');

const iconCount = (html.match(/data-audience-icon=/g) || []).length;
if (iconCount !== 5) throw new Error(`Expected exactly 5 audience icons, found ${iconCount}`);

for (const required of [
  '.hero::before{content:none!important',
  '.brand-banner-image{display:block',
  'aspect-ratio:3/1',
  '.audience-card{display:grid!important',
  '.audience-icon{grid-area:icon',
  '@media(max-width:800px)',
  '@media(max-width:480px)'
]) {
  if (!css.includes(required)) throw new Error(`Brand CSS missing ${required}`);
}

console.log('Brand policy OK: generated AVIF hero banner, five unified icons, and responsive layout are enforced.');
