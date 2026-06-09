import sharp from 'sharp';
import { mkdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..');
const svgPath = path.join(projectRoot, 'assets', 'focus.svg');
const outDir = path.join(projectRoot, 'public', 'icons');

// Matches the green focus toggle in the popup UI.
const BRAND = { r: 22, g: 163, b: 74 };

await mkdir(outDir, { recursive: true });

const baseSvg = await readFile(svgPath, 'utf8');

function whiteIconSvg(strokeWidth) {
  return baseSvg
    .replace(/stroke:#000/g, 'stroke:#ffffff')
    .replace(
      '</style>',
      `.b{stroke-width:${strokeWidth};}</style>`,
    );
}

function roundedBackgroundSvg(size, radius) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${radius}" fill="rgb(${BRAND.r},${BRAND.g},${BRAND.b})"/>
  </svg>`;
}

for (const size of [16, 32, 48, 128]) {
  const padding = Math.max(2, Math.round(size * 0.18));
  const glyphSize = size - padding * 2;
  const radius = Math.round(size * 0.22);
  const strokeWidth = Math.max(1.8, size * 0.06);

  const background = await sharp(Buffer.from(roundedBackgroundSvg(size, radius)))
    .resize(size, size)
    .png()
    .toBuffer();

  const glyph = await sharp(Buffer.from(whiteIconSvg(strokeWidth)), { density: 300 })
    .resize(glyphSize, glyphSize)
    .png()
    .toBuffer();

  const out = path.join(outDir, `icon-${size}.png`);
  await sharp(background)
    .composite([{ input: glyph, gravity: 'center' }])
    .png()
    .toFile(out);

  console.log(`Generated ${out}`);
}
