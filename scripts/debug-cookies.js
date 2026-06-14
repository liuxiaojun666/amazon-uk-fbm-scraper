import { createBrowser } from '../src/scraper/browser.js';
import { buildProductUrl, gotoWithRetry } from '../src/scraper/browser.js';
import { acceptCookiesOnPage } from '../src/scraper/location.js';

const { browser, page } = await createBrowser({ headless: true });
await gotoWithRetry(page, buildProductUrl('B0CTCD7CS5'));
await page.waitForTimeout(1000);

const before = await page.evaluate(() => ({
  cookieBtns: [...document.querySelectorAll('[id*="sp-cc"], [class*="sp-cc"], button, a')].slice(0, 30).map((el) => ({
    tag: el.tagName,
    id: el.id,
    text: el.textContent?.trim().slice(0, 60),
  })),
  hasOverlay: Boolean(document.querySelector('#sp-cc, .sp-cc, #a-page')),
}));

console.log('Before accept:', JSON.stringify(before, null, 2));
const accepted = await acceptCookiesOnPage(page);
console.log('acceptCookiesOnPage:', accepted);
await page.waitForTimeout(1000);

const after = await page.evaluate(() => ({
  cookieText: document.body.innerText.includes('cookie preferences'),
  soldBy: document.querySelector('#merchantInfoFeature_feature_div')?.textContent?.trim(),
  fulfilled: document.querySelector('#fulfillerInfoFeature_feature_div')?.textContent?.trim(),
  sellers: [...document.querySelectorAll('a[href*="seller="]')].slice(0, 3).map((a) => a.textContent?.trim()),
}));

console.log('After accept:', JSON.stringify(after, null, 2));
await browser.close();
