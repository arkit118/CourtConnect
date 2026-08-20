// One-off/rerunnable generator for iOS app icon + splash screen images from
// the CourtConnect brand marks in src/assets/brand/. Requires `sharp`
// (install with `npm install sharp --no-save` if not already present -
// it's a generation-time tool, not a runtime dependency, so it's not in
// package.json).
//
// Usage: node scripts/generate-ios-assets.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

async function centeredOnCanvas(inputPath, canvasSize, logoTargetSize) {
  const resized = await sharp(inputPath)
    .resize({
      width: logoTargetSize,
      height: logoTargetSize,
      fit: 'inside',
    })
    .toBuffer();

  const meta = await sharp(resized).metadata();
  const left = Math.round((canvasSize - meta.width) / 2);
  const top = Math.round((canvasSize - meta.height) / 2);

  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: WHITE,
    },
  })
    .composite([{ input: resized, left, top }])
    .flatten({ background: WHITE }) // no alpha channel - App Store rejects icons with transparency
    .png();
}

async function writeAppIcon() {
  const out = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png';
  mkdirSync(dirname(out), { recursive: true });
  const img = await centeredOnCanvas('src/assets/brand/logo-icon.png', 1024, 700);
  await img.toFile(out);
  console.log('wrote', out, '(1024x1024)');

  // Also drop a copy at repo root for easy upload to App Store Connect marketing assets.
  const marketingCopy = 'docs/assets/app-store-icon-1024.png';
  mkdirSync(dirname(marketingCopy), { recursive: true });
  await (await centeredOnCanvas('src/assets/brand/logo-icon.png', 1024, 700)).toFile(marketingCopy);
  console.log('wrote', marketingCopy, '(1024x1024, App Store Connect upload copy)');
}

async function writeSplash() {
  const canvasSize = 2732;
  const dir = 'ios/App/App/Assets.xcassets/Splash.imageset';
  mkdirSync(dir, { recursive: true });

  // Splash uses the full lockup (racket mark + wordmark) at a modest width so
  // it reads clearly without dominating the screen on smaller phones.
  const resized = await sharp('src/assets/brand/logo-lockup.png')
    .resize({ width: 1400, fit: 'inside' })
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const left = Math.round((canvasSize - meta.width) / 2);
  const top = Math.round((canvasSize - meta.height) / 2);

  const splash = () =>
    sharp({
      create: { width: canvasSize, height: canvasSize, channels: 4, background: WHITE },
    })
      .composite([{ input: resized, left, top }])
      .flatten({ background: WHITE })
      .png();

  // Same image referenced at 1x/2x/3x scale, matching Capacitor's default
  // single-splash-image setup (ios/App/App/Assets.xcassets/Splash.imageset/Contents.json).
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    const out = `${dir}/${name}`;
    await splash().toFile(out);
    console.log('wrote', out, `(${canvasSize}x${canvasSize})`);
  }
}

await writeAppIcon();
await writeSplash();
