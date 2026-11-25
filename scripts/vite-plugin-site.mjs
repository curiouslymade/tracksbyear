// Vite plugin: fills the {{placeholders}} in each HTML page from site.config.json,
// and writes _headers, robots.txt, sitemap.xml and manifest.webmanifest into dist/.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from 'vite';
import {
  loadConfig, checkRepo, checkPublicEnvNames, htmlValues, headerValues,
  renderTemplate, robotsTxt, sitemapXml, manifestJson,
} from './site.mjs';

export default function sitePlugin({ sitemapPaths = [''], extraHtmlValues = () => ({}) } = {}) {
  let config;
  let root;
  return {
    name: 'curiouslymade-site',
    configResolved(resolved) {
      root = resolved.root;
      config = loadConfig(root);
      checkPublicEnvNames({ ...process.env, ...loadEnv(resolved.mode, root, 'VITE_') });
      if (resolved.command === 'build') {
        const result = checkRepo(config, { root });
        if (result.warning) resolved.logger.warn(`\n${result.warning}\n`);
      }
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return renderTemplate(html, { ...htmlValues(config), ...extraHtmlValues(config) });
      },
    },
    generateBundle() {
      const headers = renderTemplate(readFileSync(join(root, 'headers.template'), 'utf8'), headerValues(config))
        .replace(/\n{3,}/g, '\n\n');
      this.emitFile({ type: 'asset', fileName: '_headers', source: headers });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(config) });
      if (config.indexed) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(config, sitemapPaths) });
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifestJson(config) });
    },
  };
}
