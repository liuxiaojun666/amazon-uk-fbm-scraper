import dotenv from 'dotenv';
import { createBrowser, buildSearchUrl } from '../src/scraper/browser.js';

dotenv.config();

const keyword = process.argv[2] || 'phone case';

const { browser, page } = await createBrowser({ headless: true });
const url = buildSearchUrl(keyword);

console.log('URL:', url);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

console.log('Title:', await page.title());
console.log('Final URL:', page.url());

const info = await page.evaluate(() => ({
  resultCount: document.querySelectorAll('[data-component-type="s-search-result"]').length,
  asinCount: document.querySelectorAll('[data-asin]:not([data-asin=""])').length,
  bodySnippet: document.body?.innerText?.slice(0, 800),
}));

console.log('Search result elements:', info.resultCount);
console.log('ASIN elements:', info.asinCount);
console.log('Body snippet:\n', info.bodySnippet);

await browser.close();
