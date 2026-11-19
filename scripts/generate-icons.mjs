// Generates the app icons (white rounded square with a dumbbell on dark green) into public/.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const GREEN = '#36493B';
const dumbbell = (color) => `
  <g fill="${color}">
    <rect x="-150" y="-14" width="300" height="28" rx="10"/>
    <rect x="-128" y="-70" width="40" height="140" rx="14"/>
    <rect x="-172" y="-48" width="34" height="96" rx="12"/>
    <rect x="88" y="-70" width="40" height="140" rx="14"/>
    <rect x="138" y="-48" width="34" height="96" rx="12"/>
  </g>`;

// Standard icon: dark green background, white rounded square, green dumbbell (like the Pocket wallet tile)
const standard = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3E5444"/><stop offset="1" stop-color="#2C3B30"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <rect x="96" y="96" width="320" height="320" rx="76" fill="#FFFFFF"/>
  <g transform="translate(256 256) rotate(-30) scale(0.78)">${dumbbell(GREEN)}</g>
</svg>`;

// Maskable: keep content inside the 80% safe zone
const maskable = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${GREEN}"/>
  <rect x="136" y="136" width="240" height="240" rx="58" fill="#FFFFFF"/>
  <g transform="translate(256 256) rotate(-30) scale(0.58)">${dumbbell(GREEN)}</g>
</svg>`;

mkdirSync('public', { recursive: true });
const out = [
  ['icon-192.png', standard(192), 192],
  ['icon-512.png', standard(512), 512],
  ['apple-touch-icon.png', standard(180), 180],
  ['favicon.png', standard(64), 64],
  ['icon-maskable-512.png', maskable, 512],
];
for (const [name, svg, size] of out) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/${name}`);
  console.log('wrote public/' + name);
}
