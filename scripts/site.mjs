// Shared site logic: load and check site.config.json, find the repo of this build,
// and build the security headers. The Vite plugin, check-dist.mjs and the tests use it.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export const SERVICE_KINDS = ['connect', 'img', 'media', 'font', 'frame'];
// The kinds that can also list "blob:".
export const BLOB_KINDS = ['img', 'media'];

// Permissions that every site turns off. A site can allow one in site.config.json "permissionsAllow".
export const DEFAULT_DENIED_PERMISSIONS = [
  'accelerometer', 'autoplay', 'camera', 'display-capture', 'geolocation', 'gyroscope',
  'magnetometer', 'microphone', 'midi', 'payment', 'usb', 'browsing-topics',
];

// Names of build variables that look like secrets. Vite puts each VITE_* value in the
// browser bundle, so a secret with one of these names must never use the VITE_ prefix.
const SECRET_NAME = /(SECRET|PASSWORD|PASSWD|PRIVATE|TOKEN|API_?KEY|CREDENTIAL)/i;

export function loadConfig(root = process.cwd()) {
  const raw = readFileSync(join(root, 'site.config.json'), 'utf8');
  const config = JSON.parse(raw);
  validateConfig(config);
  return config;
}

export function validateConfig(c) {
  const errors = [];
  const need = (key, test, message) => { if (!test(c[key])) errors.push(`"${key}": ${message}`); };
  const text = (v) => typeof v === 'string' && v.trim().length > 0;
  const siteUrl = (v) => text(v) && /^https:\/\/[a-z0-9.-]+\/$/.test(v);

  need('name', text, 'give the app name.');
  need('title', text, 'give the page title.');
  need('description', (v) => text(v) && v.length <= 200, 'give a one-line description of 200 characters or fewer.');
  need('url', siteUrl, 'give the live address, for example "https://tally.curiouslymade.dev/" (https, ends with /).');
  need('hub', siteUrl, 'give the hub address, for example "https://curiouslymade.dev/".');
  need('repo', (v) => text(v) && /^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+(?<!\.git)$/.test(v),
    'give the public repo address, for example "https://github.com/curiouslymade/tally" (no .git, no trailing /).');
  need('indexed', (v) => typeof v === 'boolean', 'use true (search engines can list the site) or false (unlisted).');
  need('themeColor', (v) => /^#[0-9a-f]{6}$/i.test(v), 'give a colour such as "#3b2244".');
  need('backgroundColor', (v) => /^#[0-9a-f]{6}$/i.test(v), 'give a colour such as "#ebe3d5".');

  const services = c.services ?? {};
  if (typeof services !== 'object' || Array.isArray(services)) {
    errors.push('"services": use an object, for example { "connect": [] }.');
  } else {
    for (const [kind, list] of Object.entries(services)) {
      if (!SERVICE_KINDS.includes(kind)) { errors.push(`"services.${kind}": use only ${SERVICE_KINDS.join(', ')}.`); continue; }
      if (!Array.isArray(list)) { errors.push(`"services.${kind}": use a list.`); continue; }
      for (const origin of list) {
        // "blob:" is an image or a sound that the page makes in the browser, for example a share card.
        if (origin === 'blob:' && BLOB_KINDS.includes(kind)) continue;
        if (!isServiceOrigin(origin)) {
          errors.push(`"services.${kind}": "${origin}" is not allowed. Use an https origin with no path, for example "https://api.example.com".`);
        }
      }
    }
  }
  for (const p of c.permissionsAllow ?? []) {
    if (!DEFAULT_DENIED_PERMISSIONS.includes(p)) errors.push(`"permissionsAllow": "${p}" is not a known permission.`);
  }
  if (c.hstsPreload !== undefined && typeof c.hstsPreload !== 'boolean') errors.push('"hstsPreload": use true or false.');
  if (c.email !== undefined && !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(c.email)) errors.push('"email": give an address such as "hello@curiouslymade.dev", or leave it out.');
  if (c.sourceLink !== undefined && typeof c.sourceLink !== 'boolean') errors.push('"sourceLink": use true (public repo) or false (private repo, no link).');

  if (errors.length) throw new Error(`site.config.json is not correct:\n- ${errors.join('\n- ')}`);
  return true;
}

export function isServiceOrigin(origin) {
  return typeof origin === 'string' && /^https:\/\/(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d{1,5})?$/i.test(origin);
}

// Returns "owner/repo" in lower case, or null. Never print the input: a CI clone URL can hold a token.
export function parseGitHubRepo(url) {
  const m = String(url ?? '').trim().match(/github\.com[/:]([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}`.toLowerCase() : null;
}

function gitOrigin(root) {
  try {
    return execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return null;
  }
}

// Finds the repo that this build comes from. GitHub Actions sets GITHUB_REPOSITORY.
// Elsewhere (Cloudflare Workers Builds, a local clone) the git remote "origin" gives it.
export function detectRepo({ env = process.env, root = process.cwd(), readOrigin = gitOrigin } = {}) {
  if (env.GITHUB_REPOSITORY) return { repo: env.GITHUB_REPOSITORY.toLowerCase(), source: 'GITHUB_REPOSITORY' };
  const fromGit = parseGitHubRepo(readOrigin(root));
  if (fromGit) return { repo: fromGit, source: 'git remote origin' };
  return { repo: null, source: null };
}

// Stops the build when the configured repo is missing or is not the repo of this build.
export function checkRepo(config, options = {}) {
  const env = options.env ?? process.env;
  const configured = parseGitHubRepo(config.repo);
  if (!configured) throw new Error('site.config.json: "repo" is missing. Give the public repo address of this site.');
  const { repo, source } = detectRepo(options);
  if (!repo) {
    if (env.CI) throw new Error('Cannot find the repo of this build. The build needs GITHUB_REPOSITORY or a git remote "origin".');
    return { ok: true, warning: `Cannot find the repo of this build. Add a git remote "origin" to check "${config.repo}".` };
  }
  if (repo !== configured) {
    throw new Error(`site.config.json: "repo" is "${config.repo}", but this build comes from github.com/${repo} (${source}). Change "repo" to the address of this repo.`);
  }
  return { ok: true, repo, source };
}

// Stops the build when a VITE_* variable has a name that looks like a secret.
export function checkPublicEnvNames(env = process.env) {
  const bad = Object.keys(env).filter((k) => k.startsWith('VITE_') && SECRET_NAME.test(k));
  if (bad.length) {
    throw new Error(`These variables go into the browser bundle, but their names look like secrets: ${bad.join(', ')}. ` +
      'Keep a real secret in a server-side Worker, never in the browser. Rename a public value so that it does not look like a secret.');
  }
}

export function buildCsp(config) {
  const s = config.services ?? {};
  const list = (kind) => ["'self'", ...(s[kind] ?? [])].join(' ');
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    `img-src ${list('img')}`,
    `font-src ${list('font')}`,
    `connect-src ${list('connect')}`,
    `media-src ${list('media')}`,
    ...(s.frame?.length ? [`frame-src ${s.frame.join(' ')}`] : []),
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function buildPermissionsPolicy(config) {
  const allow = new Set(config.permissionsAllow ?? []);
  return DEFAULT_DENIED_PERMISSIONS.map((p) => `${p}=${allow.has(p) ? '(self)' : '()'}`).join(', ');
}

export function buildHsts(config) {
  return `max-age=31536000; includeSubDomains${config.hstsPreload ? '; preload' : ''}`;
}

export function renderTemplate(text, values) {
  return text.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (match, key) => {
    if (!(key in values)) throw new Error(`Unknown placeholder ${match}.`);
    return values[key];
  });
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export function htmlValues(config) {
  const siteName = new URL(config.hub).host;
  const v = {
    name: config.name,
    title: config.title,
    description: config.description,
    url: config.url,
    hub: config.hub,
    hubName: siteName,
    repo: config.repo,
    themeColor: config.themeColor,
    robots: config.indexed ? 'index, follow' : 'noindex, nofollow',
    ogImage: `${config.url}og.png`,
  };
  const escaped = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, escapeHtml(val)]));
  // The "Source code" button in the dock. A site with a private repo sets "sourceLink": false, so it shows no link.
  escaped.sourceLink = showsSourceLink(config)
    ? `<a class="dock__btn" href="${escaped.repo}" data-source-link><span class="dock__icon">${ICONS.source}</span><span class="dock__label">Source</span></a>`
    : '';
  // The "Email" button in the dock. It shows only when site.config.json has "email".
  // The email_off markers stop Cloudflare Email Obfuscation, which adds a script that the CSP blocks.
  escaped.emailLink = config.email
    ? `<!--email_off--><a class="dock__btn" href="mailto:${escapeHtml(config.email)}" data-email-link><span class="dock__icon">${ICONS.mail}</span><span class="dock__label">Email</span></a><!--/email_off-->`
    : '';
  for (const [name, svg] of Object.entries(ICONS)) escaped[`icon${name[0].toUpperCase()}${name.slice(1)}`] = svg;
  return escaped;
}

// Icons for the dock, from Lucide (ISC licence), on a 24px grid with a 1.75 stroke.
const svg = (body) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
export const ICONS = {
  apps: svg('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
  home: svg('<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  source: svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  mail: svg('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
  moon: svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
};

export function showsSourceLink(config) {
  return config.sourceLink !== false;
}

export function headerValues(config) {
  return {
    csp: buildCsp(config),
    hsts: buildHsts(config),
    permissionsPolicy: buildPermissionsPolicy(config),
    robotsHeader: config.indexed ? '' : '  X-Robots-Tag: noindex, nofollow',
  };
}

export function robotsTxt(config) {
  return config.indexed
    ? `User-agent: *\nAllow: /\n\nSitemap: ${config.url}sitemap.xml\n`
    : 'User-agent: *\nAllow: /\n';
}

export function sitemapXml(config, paths = ['']) {
  const urls = paths.map((p) => `  <url><loc>${escapeHtml(config.url + p)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function manifestJson(config) {
  return JSON.stringify({
    name: config.name,
    short_name: config.shortName ?? config.name,
    description: config.description,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'en-GB',
    theme_color: config.themeColor,
    background_color: config.backgroundColor,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2) + '\n';
}

// Removes // and /* */ comments from JSONC text. Text inside strings stays as it is.
export function stripJsonComments(text) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\') { out += next ?? ''; i++; } else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true; out += ch;
    } else if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
    } else {
      out += ch;
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

export function loadWranglerConfig(root = process.cwd()) {
  return JSON.parse(stripJsonComments(readFileSync(join(root, 'wrangler.jsonc'), 'utf8')));
}

// Reads a Cloudflare _headers file into { "/path": { "header-name": "value" } }.
export function parseHeaders(text) {
  const rules = {};
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { current = line.trim(); rules[current] ??= {}; continue; }
    const at = line.indexOf(':');
    if (!current || at < 0) continue;
    rules[current][line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
  }
  return rules;
}
