// One-off script: render the brand SVG into the PNG sizes a PWA / Play Store
// wrapper expects. Re-run whenever the favicon changes.
//
//   node scripts/generate-pwa-icons.mjs
//
// Outputs into /public:
//   - pwa-192x192.png        (Android home screen, default purpose)
//   - pwa-512x512.png        (install prompt large icon)
//   - pwa-maskable-512x512.png (Android adaptive icon — 20% safe-zone padding)
//   - apple-touch-icon.png   (iOS home screen, 180x180, opaque background)

import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const publicDir = resolve(root, 'public');
const svgPath = resolve(publicDir, 'favicon.svg');

if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });

const svg = readFileSync(svgPath);

const BRAND_BG = { r: 0xff, g: 0xff, b: 0xff, alpha: 1 };
const BRAND_THEME = { r: 0x63, g: 0x66, b: 0xf1, alpha: 1 }; // #6366f1

async function renderTransparent(size, out) {
  // Glyph fills ~80% of canvas, transparent background — looks crisp on any wallpaper.
  const inner = Math.round(size * 0.78);
  const pad = Math.round((size - inner) / 2);
  const glyph = await sharp(svg).resize(inner, inner, { fit: 'contain' }).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: glyph, top: pad, left: pad }])
    .png()
    .toFile(resolve(publicDir, out));
  console.log('  ✓', out);
}

async function renderMaskable(size, out) {
  // Maskable: themed background + glyph occupying the inner 60% (Android's 40% safe zone).
  const inner = Math.round(size * 0.6);
  const pad = Math.round((size - inner) / 2);
  const glyph = await sharp(svg).resize(inner, inner, { fit: 'contain' }).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BRAND_BG },
  })
    .composite([{ input: glyph, top: pad, left: pad }])
    .png()
    .toFile(resolve(publicDir, out));
  console.log('  ✓', out);
}

async function renderAppleTouch(size, out) {
  // iOS doesn't honour transparency — bake the white background in.
  const inner = Math.round(size * 0.72);
  const pad = Math.round((size - inner) / 2);
  const glyph = await sharp(svg).resize(inner, inner, { fit: 'contain' }).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BRAND_BG },
  })
    .composite([{ input: glyph, top: pad, left: pad }])
    .png()
    .toFile(resolve(publicDir, out));
  console.log('  ✓', out);
}

console.log('Generating PWA icons from', svgPath);
await renderTransparent(192, 'pwa-192x192.png');
await renderTransparent(512, 'pwa-512x512.png');
await renderMaskable(512, 'pwa-maskable-512x512.png');
await renderAppleTouch(180, 'apple-touch-icon.png');
console.log('Done. Suppress the warning by ignoring `pwa-*.png` in git or commit them.');
