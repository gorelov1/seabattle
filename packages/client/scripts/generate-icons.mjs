/**
 * Generates Android launcher icons from a source PNG.
 * Run: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(__dirname, '../android/app/src/main/assets/icon.png');
const ANDROID_RES = join(__dirname, '../android/app/src/main/res');

// Android mipmap sizes for launcher icons
const SIZES = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

// Round icon sizes (for adaptive icons foreground)
const ROUND_SIZES = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

async function generate() {
  console.log('Generating Android icons from:', SOURCE);

  for (const { dir, size } of SIZES) {
    const outDir = join(ANDROID_RES, dir);
    mkdirSync(outDir, { recursive: true });

    // ic_launcher.png
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
      .png()
      .toFile(join(outDir, 'ic_launcher.png'));

    // ic_launcher_round.png (circular crop)
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
      .png()
      .toFile(join(outDir, 'ic_launcher_round.png'));

    console.log(`  ✓ ${dir}/ic_launcher.png (${size}×${size})`);
  }

  // Also generate a high-res version for the Play Store (512×512)
  const playStoreOut = join(__dirname, '../android/app/src/main/assets/icon-512.png');
  await sharp(SOURCE)
    .resize(512, 512, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .png()
    .toFile(playStoreOut);
  console.log('  ✓ assets/icon-512.png (512×512) — Play Store icon');

  console.log('\nDone! Icons written to android/app/src/main/res/mipmap-*/');
}

generate().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
