// Checks the built site in dist/ before it can deploy. It stops the build when:
// - a security header is missing or weaker than the rules,
// - the "Source code" or hub link is missing or wrong,
// - the link preview tags, icons, robots.txt or sitemap do not match site.config.json,
// - wrangler.jsonc does not match site.config.json.
// It also reports the page weight of the first load.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  loadConfig, checkRepo, buildCsp, buildPermissionsPolicy, buildHsts, loadWranglerConfig, parseHeaders, showsSourceLink,
} from './site.mjs';

const root = process.cwd();
const dist = join(root, 'dist');
const failures = [];
const fail = (message) => failures.push(message);
const read = (file) => readFileSync(join(dist, file), 'utf8');

function attr(html, pattern) {
  const m = html.match(pattern);
  return m ? m[1] : null;
}

function pngSize(file) {
  const b = readFileSync(file);
  if (b.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

function checkHeaders(config) {
  if (!existsSync(join(dist, '_headers'))) { fail('dist/_headers is missing.'); return; }
  const all = parseHeaders(read('_headers'));
  const h = all['/*'];
  if (!h) { fail('dist/_headers has no "/*" rule.'); return; }

  const csp = h['content-security-policy'] ?? '';
  if (csp !== buildCsp(config)) fail('Content-Security-Policy does not match site.config.json "services".');
  for (const d of ["default-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'", "form-action 'self'"]) {
    if (!csp.split(';').map((s) => s.trim()).includes(d)) fail(`Content-Security-Policy must contain ${d}.`);
  }
  if (/'unsafe-|\bdata:|\bhttp:|\s\*(\s|;|$)/.test(csp)) fail("Content-Security-Policy must not allow 'unsafe-*', data:, http: or *.");

  const hsts = h['strict-transport-security'] ?? '';
  if (hsts !== buildHsts(config) || !/includeSubDomains/.test(hsts)) fail('Strict-Transport-Security must be max-age=31536000 with includeSubDomains.');
  if (/preload/.test(hsts) && !config.hstsPreload) fail('Strict-Transport-Security has preload, but site.config.json does not allow it.');
  if (h['x-content-type-options'] !== 'nosniff') fail('X-Content-Type-Options must be nosniff.');
  if (h['x-frame-options'] !== 'DENY') fail('X-Frame-Options must be DENY.');
  if (!['no-referrer', 'same-origin', 'strict-origin', 'strict-origin-when-cross-origin'].includes(h['referrer-policy'])) fail('Referrer-Policy is missing or too open.');
  if (h['permissions-policy'] !== buildPermissionsPolicy(config)) fail('Permissions-Policy does not match site.config.json.');
  if (h['cross-origin-opener-policy'] !== 'same-origin') fail('Cross-Origin-Opener-Policy must be same-origin.');
  const robotsHeader = h['x-robots-tag'];
  if (config.indexed && robotsHeader) fail('X-Robots-Tag is set, but site.config.json "indexed" is true.');
  if (!config.indexed && !/noindex/.test(robotsHeader ?? '')) fail('X-Robots-Tag noindex is missing, but site.config.json "indexed" is false.');
  if (Object.keys(all).length > 100) fail('dist/_headers has more than 100 rules (the Cloudflare limit).');
}

function checkPage(file, config, { isMainPage }) {
  const name = relative(dist, file);
  const html = readFileSync(file, 'utf8');
  if (/\{\{\s*[a-zA-Z]+\s*\}\}/.test(html)) fail(`${name}: a {{placeholder}} is not filled.`);

  const source = attr(html, /<a\s[^>]*href="([^"]+)"[^>]*data-source-link/) ?? attr(html, /<a\s[^>]*data-source-link[^>]*href="([^"]+)"/);
  if (showsSourceLink(config)) {
    if (source !== config.repo) fail(`${name}: the "Source code" link must be ${config.repo} (found ${source ?? 'none'}).`);
  } else if (source || html.includes(config.repo)) {
    fail(`${name}: "sourceLink" is false (private repo), but the page links to the repo. Visitors would get a 404.`);
  }
  const hub = attr(html, /<a\s[^>]*href="([^"]+)"[^>]*data-hub-link/) ?? attr(html, /<a\s[^>]*data-hub-link[^>]*href="([^"]+)"/);
  if (hub !== config.hub) fail(`${name}: the hub link must be ${config.hub} (found ${hub ?? 'none'}).`);

  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const src = attr(m[1], /src="([^"]+)"/);
    if (!src && m[2].trim()) fail(`${name}: inline <script> found. The Content Security Policy blocks it.`);
    if (src && /^(https?:)?\/\//.test(src)) fail(`${name}: third-party script ${src} found.`);
  }
  if (/<link\b[^>]*rel="stylesheet"[^>]*href="(https?:)?\/\//.test(html)) fail(`${name}: third-party stylesheet found.`);
  if (/\sstyle="/.test(html)) fail(`${name}: inline style="" found. The Content Security Policy blocks it.`);

  if (!isMainPage) return;
  const title = attr(html, /<title>([^<]+)<\/title>/);
  if (!title) fail(`${name}: <title> is missing.`);
  if (!attr(html, /<meta name="description" content="([^"]+)"/)) fail(`${name}: meta description is missing.`);
  if (attr(html, /<link rel="canonical" href="([^"]+)"/) !== config.url) fail(`${name}: canonical link must be ${config.url}.`);
  const robots = attr(html, /<meta name="robots" content="([^"]+)"/) ?? '';
  if (config.indexed === /noindex/.test(robots)) fail(`${name}: meta robots does not match site.config.json "indexed".`);
  for (const p of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt']) {
    if (!new RegExp(`<meta property="${p}" content="[^"]+"`).test(html)) fail(`${name}: ${p} is missing.`);
  }
  for (const n of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    if (!new RegExp(`<meta name="${n}" content="[^"]+"`).test(html)) fail(`${name}: ${n} is missing.`);
  }
  const ogImage = attr(html, /<meta property="og:image" content="([^"]+)"/);
  if (ogImage !== `${config.url}og.png`) fail(`${name}: og:image must be ${config.url}og.png.`);
}

function checkFiles(config) {
  const og = join(dist, 'og.png');
  if (!existsSync(og)) fail('dist/og.png is missing. Run "npm run images".');
  else {
    const size = pngSize(og);
    if (!size || size.width !== 1200 || size.height !== 630) fail('dist/og.png must be a 1200 x 630 PNG.');
  }
  for (const [file, px] of [['icons/icon-32.png', 32], ['icons/icon-192.png', 192], ['icons/icon-512.png', 512], ['icons/apple-touch-icon.png', 180]]) {
    const p = join(dist, file);
    if (!existsSync(p)) { fail(`dist/${file} is missing. Run "npm run images".`); continue; }
    const size = pngSize(p);
    if (!size || size.width !== px || size.height !== px) fail(`dist/${file} must be ${px} x ${px} pixels.`);
  }
  if (!existsSync(join(dist, 'favicon.svg'))) fail('dist/favicon.svg is missing.');

  const manifest = JSON.parse(read('manifest.webmanifest'));
  if (manifest.name !== config.name) fail('manifest.webmanifest name does not match site.config.json.');

  const robots = read('robots.txt');
  const hasSitemap = existsSync(join(dist, 'sitemap.xml'));
  if (config.indexed) {
    if (!robots.includes(`Sitemap: ${config.url}sitemap.xml`)) fail('robots.txt must name the sitemap.');
    if (!hasSitemap) fail('sitemap.xml is missing.');
    else if (!read('sitemap.xml').includes(`<loc>${config.url}</loc>`)) fail(`sitemap.xml must list ${config.url}.`);
  } else if (hasSitemap) fail('sitemap.xml exists, but site.config.json "indexed" is false.');
  if (/Disallow:\s*\/\s*$/m.test(robots)) fail('robots.txt must not block crawlers. Use "indexed": false, which adds noindex.');
}

function checkWrangler(config) {
  const w = loadWranglerConfig(root);
  const host = new URL(config.url).host;
  if (!w.name) fail('wrangler.jsonc: "name" is missing.');
  if (w.workers_dev !== false) fail('wrangler.jsonc: set "workers_dev": false, so the site is only on its own address.');
  if (w.preview_urls !== false) fail('wrangler.jsonc: set "preview_urls": false.');
  if (w.assets?.directory !== './dist') fail('wrangler.jsonc: "assets.directory" must be "./dist".');
  if (!['single-page-application', '404-page'].includes(w.assets?.not_found_handling)) fail('wrangler.jsonc: set "assets.not_found_handling".');
  const routes = (w.routes ?? []).filter((r) => r.custom_domain);
  if (!routes.some((r) => r.pattern === host)) fail(`wrangler.jsonc: add a route { "pattern": "${host}", "custom_domain": true }.`);
}

function pageWeight() {
  const html = read('index.html');
  const refs = [...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css|woff2))"/g)].map((m) => m[1]);
  const css = refs.filter((r) => r.endsWith('.css')).map((r) => readFileSync(join(dist, r), 'utf8')).join('');
  const fonts = [...css.matchAll(/url\("?(\/fonts\/[^")]+)"?\)/g)].map((m) => m[1]);
  const files = [...new Set(['/index.html', ...refs, ...fonts])].filter((f) => existsSync(join(dist, f)));
  let raw = 0; let gz = 0;
  for (const f of files) {
    const b = readFileSync(join(dist, f));
    raw += b.length;
    gz += f.endsWith('.woff2') ? b.length : gzipSync(b).length;
  }
  return { files: files.length, raw, gz };
}

const config = loadConfig(root);
try { checkRepo(config, { root }); } catch (e) { fail(e.message); }
if (!existsSync(dist)) { console.error('dist/ is missing. Run "npm run build" first.'); process.exit(1); }
checkHeaders(config);
for (const file of htmlFiles(dist)) checkPage(file, config, { isMainPage: relative(dist, file) === 'index.html' });
checkFiles(config);
checkWrangler(config);

if (failures.length) {
  console.error(`\ncheck-dist: ${failures.length} problem(s) found:\n- ${failures.join('\n- ')}\n`);
  process.exit(1);
}
const w = pageWeight();
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`check-dist: all checks passed. First load: ${w.files} files, ${kb(w.raw)} raw, about ${kb(w.gz)} compressed.`);
