import { readFile } from 'node:fs/promises';

const html = await readFile('public/index.html', 'utf8');
const css = await readFile('public/brand.css', 'utf8');

for (const required of [
  'data-brand-patched="v3"',
  'class="brand-banner"',
  'class="brand-banner-art"',
  '실무에 바로 쓰는',
  'AI · 자동화',
  'href="./brand.css"',
  'data-audience-icon="knowledge-worker"',
  'data-audience-icon="small-business"',
  'data-audience-icon="freelancer"',
  'data-audience-icon="creator"',
  'data-audience-icon="developer"'
]) {
  if (!html.includes(required)) throw new Error(`Brand patch missing ${required}`);
}

if (html.includes('data:image/png;base64,')) throw new Error('Homepage banner must not rely on a base64 raster image anymore.');
if (html.includes('class="hero-picture"')) throw new Error('Legacy picture banner should be removed.');

const iconCount = (html.match(/data-audience-icon=/g) || []).length;
if (iconCount !== 5) throw new Error(`Expected exactly 5 audience icons, found ${iconCount}`);

for (const required of [
  '.hero::before{content:none!important',
  '.brand-banner{display:grid',
  '.brand-banner-art{display:block',
  '.audience-card{display:grid!important',
  '.audience-icon{grid-area:icon',
  '@media(max-width:800px)',
  '@media(max-width:480px)'
]) {
  if (!css.includes(required)) throw new Error(`Brand CSS missing ${required}`);
}

console.log('Brand policy OK: inline vector banner, five unified icons, and mobile layout are enforced without fragile image loading.');
