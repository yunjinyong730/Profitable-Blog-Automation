import { readFile } from 'node:fs/promises';

const html = await readFile('public/index.html', 'utf8');
const css = await readFile('public/brand.css', 'utf8');

for (const required of [
  'data-brand-patched="v2"',
  'class="hero-picture"',
  'data:image/png;base64,',
  'href="./brand.css"',
  'data-audience-icon="knowledge-worker"',
  'data-audience-icon="small-business"',
  'data-audience-icon="freelancer"',
  'data-audience-icon="creator"',
  'data-audience-icon="developer"'
]) {
  if (!html.includes(required)) throw new Error(`Brand patch missing ${required}`);
}

const iconCount = (html.match(/data-audience-icon=/g) || []).length;
if (iconCount !== 5) throw new Error(`Expected exactly 5 audience icons, found ${iconCount}`);
if (!html.includes('<source media="(max-width: 700px)"')) throw new Error('Responsive mobile banner source is missing.');
if (!html.includes('width="900" height="300"')) throw new Error('Desktop banner intrinsic dimensions are missing.');

for (const required of [
  '.hero::before{content:none!important',
  '.hero-picture img{aspect-ratio:3/1',
  '.audience-card{display:grid!important',
  '.audience-icon{grid-area:icon',
  '@media(max-width:800px)',
  '@media(max-width:480px)'
]) {
  if (!css.includes(required)) throw new Error(`Brand CSS missing ${required}`);
}

console.log('Brand policy OK: embedded responsive banner, five unified icons, and mobile layout are enforced.');
