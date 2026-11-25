// Makes the link preview image and the app icons from site.config.json, with headless Chrome.
// Run it after you change the name, the description or the mark: npm run images
// Output: public/og.png (1200 x 630), public/favicon.svg and public/icons/*.png. Commit the output.
// Set CHROME_PATH if Chrome is not in a usual place.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig, escapeHtml } from './site.mjs';

const root = process.cwd();
const config = loadConfig(root);
const fontUrl = (f) => pathToFileURL(join(root, 'public', 'fonts', f)).href;

export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('Cannot find Chrome. Install Chrome, or set CHROME_PATH to its program file.');
  return found;
}

// Takes a screenshot of a page. The window is width x height CSS pixels; scale sets the output size.
// scheme "light" or "dark" sets prefers-color-scheme. Omit it to use the system setting.
export function screenshot(chrome, url, out, { width, height, scale = 1, wait = 1500, scheme }) {
  const profile = mkdtempSync(join(tmpdir(), 'cm-chrome-'));
  try {
    execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${profile}`, `--window-size=${width},${height}`, `--force-device-scale-factor=${scale}`,
      `--virtual-time-budget=${wait}`, `--screenshot=${out}`,
      ...(scheme ? [`--blink-settings=preferredColorScheme=${scheme === 'dark' ? 0 : 1}`] : []), url,
    ], { stdio: 'ignore' });
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
  if (!existsSync(out)) throw new Error(`Chrome did not write ${out}.`);
}

const fontFaces = `
  @font-face { font-family: "Jost"; src: url("${fontUrl('jost-latin.woff2')}") format("woff2"); font-weight: 400 600; }
  @font-face { font-family: "Poiret One"; src: url("${fontUrl('poiret-one-latin.woff2')}") format("woff2"); }`;

// The mark: a sand vinyl record in the centre, with the lilac moon as its label, and a lilac
// tonearm at the top right. "scale" makes the drawing smaller inside the plum square. The maskable
// icon uses 0.8, so the content stays inside the centre 80% when Android crops the icon to a circle.
export function markSvg({ rounded, scale = 1 }) {
  const plum = '#3b2244'; const sand = '#edb98a'; const lilac = '#e5c6ff';
  const R = 21;
  const grooves = [0.89, 0.81, 0.73, 0.65, 0.57, 0.49].map((k, i) => `<circle cx="32" cy="32" r="${(R * k).toFixed(1)}" fill="none" stroke="${plum}" stroke-opacity="${i % 2 ? 0.14 : 0.22}" stroke-width="0.55"/>`).join('');
  const arm = 'M54 10 L55.5 33 L48 42.5';
  const head = 'M49.7 40.3 L46.1 44.9';
  const t = scale === 1 ? '' : ` transform="translate(32 32) scale(${scale}) translate(-32 -32)"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="${rounded ? 12 : 0}" fill="${plum}"/><g${t}>` +
    `<circle cx="32" cy="32" r="${R}" fill="${sand}"/>${grooves}` +
    `<circle cx="32" cy="32" r="${(R * 0.36).toFixed(1)}" fill="${lilac}"/>` +
    `<path d="${arm}" fill="none" stroke="${plum}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${arm}" fill="none" stroke="${lilac}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${head}" stroke="${plum}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="${head}" stroke="${lilac}" stroke-width="3.8" stroke-linecap="round"/>` +
    `<circle cx="54" cy="10" r="5" fill="${lilac}" stroke="${plum}" stroke-width="1.2"/>` +
    `<circle cx="54" cy="10" r="1.7" fill="${plum}"/></g></svg>`;
}

function iconPage(scale = 1) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces}
    html, body { margin: 0; width: 512px; height: 512px; overflow: hidden; background: #3b2244; }
    svg { display: block; width: 512px; height: 512px; }</style></head>
    <body>${markSvg({ rounded: false, scale })}</body></html>`;
}

function ogPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces}
    html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
    body { background: #ebe3d5; color: #2b1d13; font-family: "Jost", sans-serif; position: relative; }
    .frame { position: absolute; inset: 72px 80px 64px; display: flex; flex-direction: column; }
    .site { font-size: 30px; font-weight: 500; color: #8a4222; margin: 0 0 28px; }
    h1 { font-family: "Poiret One", sans-serif; font-weight: 400; color: #3b2244; font-size: 104px; line-height: 108px; margin: 0; max-width: 900px; }
    p { font-size: 36px; line-height: 50px; color: #5c4b3d; margin: 32px 0 0; max-width: 900px; }
    .rule { position: absolute; left: 80px; right: 80px; bottom: 64px; border-top: 2px solid #2b1d13; }
    .mark { position: absolute; top: 64px; right: 80px; width: 120px; height: 120px; }</style></head>
    <body><div class="frame"><div class="site">${escapeHtml(new URL(config.url).host)}</div>
    <h1>${escapeHtml(config.name)}</h1><p>${escapeHtml(config.description)}</p></div>
    <div class="mark">${markSvg({ rounded: true })}</div><div class="rule"></div></body></html>`;
}

function main() {
  const chrome = findChrome();
  const work = mkdtempSync(join(tmpdir(), 'cm-images-'));
  try {
    mkdirSync(join(root, 'public', 'icons'), { recursive: true });
    const icon = join(work, 'icon.html');
    writeFileSync(icon, iconPage());
    for (const [file, px] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180], ['icon-32.png', 32]]) {
      screenshot(chrome, pathToFileURL(icon).href, join(root, 'public', 'icons', file), { width: 512, height: 512, scale: px / 512 });
    }
    const maskable = join(work, 'icon-maskable.html');
    writeFileSync(maskable, iconPage(0.8));
    screenshot(chrome, pathToFileURL(maskable).href, join(root, 'public', 'icons', 'icon-maskable-512.png'), { width: 512, height: 512 });
    const og = join(work, 'og.html');
    writeFileSync(og, ogPage());
    screenshot(chrome, pathToFileURL(og).href, join(root, 'public', 'og.png'), { width: 1200, height: 630 });
    writeFileSync(join(root, 'public', 'favicon.svg'), markSvg({ rounded: true }) + '\n');
    console.log('make-images: wrote public/og.png, public/favicon.svg and public/icons/*.png.');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
