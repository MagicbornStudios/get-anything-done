#!/usr/bin/env node
/**
 * Capture title-screen screenshots of every playable eval build.
 *
 * Uses puppeteer-core with the system Chrome install — no Chromium
 * download required. ENV-FLAGGED: does nothing unless you explicitly
 * set CAPTURE_SCREENSHOTS=1.
 *
 * Usage:
 *   CAPTURE_SCREENSHOTS=1 node scripts/capture-screenshots.mjs
 *
 * Or from npm:
 *   CAPTURE_SCREENSHOTS=1 npm run screenshots
 *
 * Output: public/screenshots/<project>/<version>.png for each playable
 * build found by the prebuild's PLAYABLE_INDEX.
 *
 * Requirements:
 *   - Google Chrome installed at the standard location
 *   - The site must be built (npx next build) or running (npx next dev)
 *     for the playable paths to resolve
 *   - puppeteer-core in devDependencies (no Chromium bundled)
 *
 * This script is safe to have in the repo — it does NOTHING unless the
 * env flag is set. No CI impact, no build-step side effects, no
 * Chromium downloads.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(SITE_ROOT, 'public');
const SCREENSHOTS_DIR = path.join(PUBLIC_DIR, 'screenshots');
const PLAYABLE_DIR = path.join(PUBLIC_DIR, 'playable');

// ENV FLAG — off by default
if (process.env.CAPTURE_SCREENSHOTS !== '1') {
  console.log('capture-screenshots: CAPTURE_SCREENSHOTS not set to 1, skipping.');
  console.log('  To run: CAPTURE_SCREENSHOTS=1 node scripts/capture-screenshots.mjs');
  process.exit(0);
}

// Find Chrome
const CHROME_PATHS = [
  '/c/Program Files/Google/Chrome/Application/chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
];

let chromePath = null;
for (const p of CHROME_PATHS) {
  if (fs.existsSync(p)) {
    chromePath = p;
    break;
  }
}

if (!chromePath) {
  console.error('capture-screenshots: Chrome not found at any known path.');
  console.error('  Searched:', CHROME_PATHS.join(', '));
  process.exit(1);
}

console.log(`capture-screenshots: using Chrome at ${chromePath}`);

// Dynamic import to handle missing dep gracefully
let puppeteer;
try {
  puppeteer = await import('puppeteer-core');
} catch (err) {
  console.error('capture-screenshots: puppeteer-core not installed.');
  console.error('  Run: npm install -D puppeteer-core');
  process.exit(1);
}

// Find all playable builds
const playableBuilds = [];
if (fs.existsSync(PLAYABLE_DIR)) {
  for (const project of fs.readdirSync(PLAYABLE_DIR)) {
    const projectDir = path.join(PLAYABLE_DIR, project);
    if (!fs.statSync(projectDir).isDirectory()) continue;
    for (const version of fs.readdirSync(projectDir)) {
      const versionDir = path.join(projectDir, version);
      if (!fs.statSync(versionDir).isDirectory()) continue;
      const indexHtml = path.join(versionDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        playableBuilds.push({ project, version, indexHtml });
      }
    }
  }
}

console.log(`Found ${playableBuilds.length} playable builds to screenshot.`);

if (playableBuilds.length === 0) {
  console.log('Nothing to capture.');
  process.exit(0);
}

// Launch browser
const browser = await puppeteer.default.launch({
  executablePath: chromePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });

for (const build of playableBuilds) {
  const screenshotDir = path.join(SCREENSHOTS_DIR, build.project);
  const screenshotPath = path.join(screenshotDir, `${build.version}.png`);

  // Skip if screenshot already exists and is recent (< 7 days old)
  if (fs.existsSync(screenshotPath)) {
    const stat = fs.statSync(screenshotPath);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs < 7 * 24 * 60 * 60 * 1000) {
      console.log(`  skip ${build.project}/${build.version} (recent screenshot exists)`);
      continue;
    }
  }

  fs.mkdirSync(screenshotDir, { recursive: true });

  try {
    // Load the game's index.html directly via file:// protocol
    const fileUrl = `file:///${build.indexHtml.replace(/\\/g, '/')}`;
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 15000 });

    // Wait 3 seconds for the title screen to render
    await new Promise((r) => setTimeout(r, 3000));

    await page.screenshot({ path: screenshotPath, type: 'png' });
    const sizeKb = (fs.statSync(screenshotPath).size / 1024).toFixed(1);
    console.log(`  ✓ ${build.project}/${build.version}.png (${sizeKb} KB)`);
  } catch (err) {
    console.error(`  ✗ ${build.project}/${build.version}: ${err.message}`);
  }
}

await browser.close();
console.log(`\nScreenshots saved to public/screenshots/`);
console.log(`Embed in READMEs: ![Demo](https://get-anything-done.vercel.app/screenshots/<project>/<version>.png)`);
