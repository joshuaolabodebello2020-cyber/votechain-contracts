/**
 * axe-core accessibility audit configuration.
 * Run: node scripts/axe-audit.mjs <url>
 *
 * Requires: npm install -D axe-core puppeteer
 */
import puppeteer from 'puppeteer';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { source: axeSource } = require('axe-core');

const url = process.argv[2] ?? 'http://localhost:5173';

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle0' });
await page.evaluate(axeSource);

const results = await page.evaluate(() =>
  window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
  })
);

await browser.close();

const { violations } = results;
if (violations.length === 0) {
  console.log('✅ No WCAG AA violations found.');
} else {
  console.error(`❌ ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.error(`[${v.impact}] ${v.id}: ${v.description}`);
    for (const node of v.nodes) {
      console.error('  ', node.html);
    }
  }
  process.exit(1);
}
