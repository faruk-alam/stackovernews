'use strict';

/**
 * Generates placeholder SVG images (1200x675) for demo articles, plus the logo,
 * favicon and default Open Graph image. Run once: `node scripts/make-placeholders.js`.
 * Replace the output in /static/images with real JPG/WebP photos for production.
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'static');
const IMAGES = path.join(OUT, 'images');
fs.mkdirSync(IMAGES, { recursive: true });

const palettes = {
  technology: ['#1e3a8a', '#3b82f6', '#60a5fa'],
  business: ['#14532d', '#16a34a', '#86efac'],
  science: ['#581c87', '#9333ea', '#d8b4fe'],
  culture: ['#7c2d12', '#ea580c', '#fdba74']
};

function articleImage(category, n) {
  const [dark, mid, light] = palettes[category];
  const label = category.charAt(0).toUpperCase() + category.slice(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-label="${label} placeholder image">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${dark}"/>
      <stop offset="1" stop-color="${mid}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#g)"/>
  <circle cx="${200 + n * 250}" cy="${150 + n * 90}" r="${160 + n * 30}" fill="${light}" fill-opacity="0.18"/>
  <circle cx="${950 - n * 120}" cy="${520 - n * 60}" r="${220 - n * 40}" fill="${light}" fill-opacity="0.12"/>
  <path d="M0 560 Q 300 ${480 + n * 40} 600 540 T 1200 500 V675 H0Z" fill="${dark}" fill-opacity="0.45"/>
  <text x="60" y="610" font-family="ui-sans-serif, system-ui, sans-serif" font-size="40" font-weight="800" fill="#ffffff" fill-opacity="0.9" letter-spacing="4">${label.toUpperCase()}</text>
</svg>
`;
}

for (const category of Object.keys(palettes)) {
  for (let n = 1; n <= 3; n++) {
    fs.writeFileSync(path.join(IMAGES, `${category}-${n}.svg`), articleImage(category, n));
  }
}

const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="Logo">
  <rect width="512" height="512" rx="96" fill="#dc2626"/>
  <path d="M128 144h256v40H128zM128 236h256v40H128zM128 328h160v40H128z" fill="#fff"/>
</svg>
`;
fs.writeFileSync(path.join(OUT, 'logo.svg'), logo);
fs.writeFileSync(path.join(OUT, 'favicon.svg'), logo);

fs.writeFileSync(
  path.join(IMAGES, 'og-default.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-label="Default share image">
  <rect width="1200" height="675" fill="#0a0a0a"/>
  <rect x="80" y="230" width="140" height="140" rx="28" fill="#dc2626"/>
  <path d="M115 268h70v11h-70zM115 294h70v11h-70zM115 320h44v11h-44z" fill="#fff"/>
  <text x="250" y="320" font-family="ui-sans-serif, system-ui, sans-serif" font-size="72" font-weight="900" fill="#fff">The Daily Wire Demo</text>
  <text x="252" y="375" font-family="ui-sans-serif, system-ui, sans-serif" font-size="30" fill="#a3a3a3">Independent reporting on technology, business, science and culture.</text>
</svg>
`
);

console.log('✔ Placeholder images written to static/');
