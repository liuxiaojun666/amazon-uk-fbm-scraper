import { createBrowser } from '../src/scraper/browser.js';
import { buildOfferListingUrl, gotoWithRetry } from '../src/scraper/browser.js';
import { acceptCookiesOnPage } from '../src/scraper/location.js';
import { getProductOffers } from '../src/scraper/product.js';

const asin = 'B0CTCD7CS5';
const { browser, page } = await createBrowser({ headless: true });
await gotoWithRetry(page, buildOfferListingUrl(asin));
await acceptCookiesOnPage(page);
await page.waitForTimeout(2000);

const snippet = await page.evaluate(() => document.body.innerText.slice(0, 1200));
console.log(snippet);

const { listings } = await getProductOffers(page, { asin, title: 't', price: '' }, ['FBM', 'FBA']);
console.log('offers', listings);

await browser.close();
