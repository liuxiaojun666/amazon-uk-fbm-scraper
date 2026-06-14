import { createBrowser } from '../src/scraper/browser.js';
import { extractSearchResults } from '../src/scraper/search.js';
import { enrichProductPrice, computeRobustPriceRange } from '../src/filters/price.js';
import { buildSearchUrl, gotoWithRetry } from '../src/scraper/browser.js';

const { browser, page } = await createBrowser({ headless: true });

for (const sort of ['price-asc-rank', 'price-desc-rank']) {
  await gotoWithRetry(page, buildSearchUrl('tent', 1, { sort }));
  await page.waitForTimeout(2000);
  const products = (await extractSearchResults(page, 'tent')).map(enrichProductPrice);
  const prices = products.filter((p) => p.priceValue).slice(0, 8).map((p) => ({
    price: p.price,
    value: p.priceValue,
    gbp: p.currencyGbp,
  }));
  console.log(sort, JSON.stringify(prices, null, 2));
}

const asc = (await extractSearchResults(page, 'tent')).map(enrichProductPrice);
await gotoWithRetry(page, buildSearchUrl('tent', 1, { sort: 'price-asc-rank' }));
await page.waitForTimeout(1500);
const ascP = (await extractSearchResults(page, 'tent')).map(enrichProductPrice).map((p) => p.priceValue).filter(Boolean);
await gotoWithRetry(page, buildSearchUrl('tent', 1, { sort: 'price-desc-rank' }));
await page.waitForTimeout(1500);
const descP = (await extractSearchResults(page, 'tent')).map(enrichProductPrice).map((p) => p.priceValue).filter(Boolean);
console.log('robust', computeRobustPriceRange(ascP.slice(0,16), descP.slice(0,16)));
console.log('delivery', await page.locator('#glow-ingress-line2').textContent().catch(() => ''));

await browser.close();
