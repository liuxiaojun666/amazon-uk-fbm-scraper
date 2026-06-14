import { createBrowser } from '../src/scraper/browser.js';
import { buildOfferListingUrl, buildProductUrl, gotoWithRetry } from '../src/scraper/browser.js';

const asin = 'B0CTCD7CS5';
const { browser, page } = await createBrowser({ headless: true });

for (const [label, url] of [
  ['offer-listing', buildOfferListingUrl(asin)],
  ['product', buildProductUrl(asin)],
]) {
  await gotoWithRetry(page, url);
  await page.waitForTimeout(2000);
  const info = await page.evaluate(() => ({
    title: document.title,
    url: location.href,
    bodyLen: document.body?.innerText?.length || 0,
    snippet: document.body?.innerText?.slice(0, 800),
    sellerLinks: [...document.querySelectorAll('a[href*="seller="]')].slice(0, 5).map((a) => ({
      text: a.textContent?.trim(),
      href: a.getAttribute('href'),
    })),
    fulfilled: document.querySelector('#fulfillerInfoFeature_feature_div')?.textContent?.trim(),
    soldBy: document.querySelector('#merchantInfoFeature_feature_div')?.textContent?.trim(),
    merchantInfo: document.querySelector('#merchant-info')?.textContent?.trim()?.slice(0, 200),
  }));
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(info, null, 2));
}

await browser.close();
