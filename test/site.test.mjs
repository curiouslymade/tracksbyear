import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateConfig, parseGitHubRepo, detectRepo, checkRepo, checkPublicEnvNames, buildCsp,
  buildPermissionsPolicy, buildHsts, isServiceOrigin, renderTemplate, stripJsonComments, parseHeaders,
  robotsTxt, htmlValues,
} from '../scripts/site.mjs';

const base = () => ({
  name: 'Tally', title: 'Tally', description: 'A tap counter.',
  url: 'https://tally.curiouslymade.dev/', hub: 'https://curiouslymade.dev/',
  repo: 'https://github.com/curiouslymade/tally', indexed: true,
  themeColor: '#3b2244', backgroundColor: '#ebe3d5', services: { connect: [] },
});

test('a correct config passes', () => {
  assert.equal(validateConfig(base()), true);
});

test('a missing repo stops the build', () => {
  const c = base(); delete c.repo;
  assert.throws(() => validateConfig(c), /"repo"/);
});

test('a repo address with .git or a trailing slash is refused', () => {
  for (const repo of ['https://github.com/a/b.git', 'https://github.com/a/b/', 'http://github.com/a/b', 'github.com/a/b']) {
    assert.throws(() => validateConfig({ ...base(), repo }), /"repo"/, repo);
  }
});

test('services must be https origins with no path or wildcard host', () => {
  assert.ok(isServiceOrigin('https://api.example.com'));
  assert.ok(isServiceOrigin('https://*.example.com'));
  for (const bad of ['http://api.example.com', 'https://api.example.com/v1', '*', "'unsafe-inline'", 'data:', 'https://*']) {
    assert.equal(isServiceOrigin(bad), false, bad);
    assert.throws(() => validateConfig({ ...base(), services: { connect: [bad] } }), /services\.connect/);
  }
});

test('an unknown service kind is refused', () => {
  assert.throws(() => validateConfig({ ...base(), services: { script: ['https://cdn.example.com'] } }), /services\.script/);
});

test('parseGitHubRepo reads https, ssh and token clone URLs', () => {
  assert.equal(parseGitHubRepo('https://github.com/CuriouslyMade/Tally.git'), 'curiouslymade/tally');
  assert.equal(parseGitHubRepo('git@github.com:curiouslymade/tally.git'), 'curiouslymade/tally');
  assert.equal(parseGitHubRepo('https://x-access-token:abc123@github.com/curiouslymade/tally\n'), 'curiouslymade/tally');
  assert.equal(parseGitHubRepo('https://gitlab.com/a/b'), null);
  assert.equal(parseGitHubRepo(null), null);
});

test('detectRepo uses GITHUB_REPOSITORY first, then git origin', () => {
  assert.deepEqual(detectRepo({ env: { GITHUB_REPOSITORY: 'curiouslymade/Tally' }, readOrigin: () => null }),
    { repo: 'curiouslymade/tally', source: 'GITHUB_REPOSITORY' });
  assert.deepEqual(detectRepo({ env: {}, readOrigin: () => 'https://github.com/curiouslymade/tally.git' }),
    { repo: 'curiouslymade/tally', source: 'git remote origin' });
});

test('checkRepo stops a build from a different repo', () => {
  assert.throws(() => checkRepo(base(), { env: { GITHUB_REPOSITORY: 'curiouslymade/app-template' }, readOrigin: () => null }), /this build comes from/);
  assert.equal(checkRepo(base(), { env: { GITHUB_REPOSITORY: 'curiouslymade/tally' }, readOrigin: () => null }).ok, true);
});

test('checkRepo stops a CI build when it cannot find the repo, and warns locally', () => {
  assert.throws(() => checkRepo(base(), { env: { CI: 'true' }, readOrigin: () => null }), /Cannot find the repo/);
  assert.match(checkRepo(base(), { env: {}, readOrigin: () => null }).warning, /Cannot find the repo/);
});

test('VITE_ variables with secret-like names stop the build', () => {
  assert.throws(() => checkPublicEnvNames({ VITE_API_KEY: 'x' }), /VITE_API_KEY/);
  assert.throws(() => checkPublicEnvNames({ VITE_CLIENT_SECRET: 'x' }), /VITE_CLIENT_SECRET/);
  assert.doesNotThrow(() => checkPublicEnvNames({ VITE_OAUTH_CLIENT_ID: 'x', API_KEY: 'server-only' }));
});

test('the CSP is strict and lists only the declared services', () => {
  const csp = buildCsp({ ...base(), services: { connect: ['https://api.example.com'] } });
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /connect-src 'self' https:\/\/api\.example\.com;/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /form-action 'self'/);
  assert.doesNotMatch(csp, /unsafe|data:|frame-src/);
});

test('permissions are denied unless the config allows one', () => {
  const p = buildPermissionsPolicy({ ...base(), permissionsAllow: ['microphone'] });
  assert.match(p, /camera=\(\)/);
  assert.match(p, /microphone=\(self\)/);
});

test('HSTS has includeSubDomains, and preload only when the config allows it', () => {
  assert.equal(buildHsts(base()), 'max-age=31536000; includeSubDomains');
  assert.match(buildHsts({ ...base(), hstsPreload: true }), /; preload$/);
});

test('robots.txt never blocks crawlers, and names the sitemap only when indexed', () => {
  assert.match(robotsTxt(base()), /Sitemap: https:\/\/tally\.curiouslymade\.dev\/sitemap\.xml/);
  assert.doesNotMatch(robotsTxt({ ...base(), indexed: false }), /Sitemap|Disallow/);
});

test('the Source code link shows by default and goes away with "sourceLink": false', () => {
  assert.match(htmlValues(base()).sourceLink, /^<a class="dock__btn" href="https:\/\/github\.com\/curiouslymade\/tally" data-source-link>/);
  assert.match(htmlValues(base()).sourceLink, /<span class="dock__label">Source<\/span><\/a>$/);
  assert.equal(htmlValues({ ...base(), sourceLink: false }).sourceLink, '');
  assert.throws(() => validateConfig({ ...base(), sourceLink: 'no' }), /"sourceLink"/);
});

test('HTML values are escaped', () => {
  assert.equal(htmlValues({ ...base(), name: 'A "quoted" <name>' }).name, 'A &quot;quoted&quot; &lt;name&gt;');
});

test('renderTemplate fills placeholders and stops on an unknown one', () => {
  assert.equal(renderTemplate('Hi {{name}}', { name: 'Paul' }), 'Hi Paul');
  assert.throws(() => renderTemplate('{{nope}}', {}), /Unknown placeholder/);
});

test('stripJsonComments keeps URLs inside strings', () => {
  const parsed = JSON.parse(stripJsonComments('// note\n{ "a": "https://x.dev", /* c */ "b": [1,], }'));
  assert.deepEqual(parsed, { a: 'https://x.dev', b: [1] });
});

test('parseHeaders reads a _headers file', () => {
  const rules = parseHeaders('# c\n/*\n  X-Frame-Options: DENY\n  Content-Security-Policy: default-src \'self\'\n\n/assets/*\n  Cache-Control: max-age=1\n');
  assert.equal(rules['/*']['x-frame-options'], 'DENY');
  assert.equal(rules['/*']['content-security-policy'], "default-src 'self'");
  assert.equal(rules['/assets/*']['cache-control'], 'max-age=1');
});

test('the Email button shows only when the config has an address', () => {
  assert.equal(htmlValues(base()).emailLink, '');
  const link = htmlValues({ ...base(), email: 'hello@curiouslymade.dev' }).emailLink;
  assert.match(link, /href="mailto:hello@curiouslymade\.dev" data-email-link>/);
  assert.match(link, /^<!--email_off-->.*<!--\/email_off-->$/, 'Cloudflare Email Obfuscation must skip the link');
  assert.throws(() => validateConfig({ ...base(), email: 'not an address' }), /"email"/);
});
