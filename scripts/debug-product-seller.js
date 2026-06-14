import dotenv from 'dotenv';
import { createBrowser } from '../src/scraper/browser.js';
import { setDeliveryPostcode } from '../src/scraper/location.js';

dotenv.config();

const asin = process.argv[2] || 'B0CPMDK6B5';
const { browser, page } = await createBrowser({ headless: true });

try {
  await setDeliveryPostcode(page, 'SW1A 1AA');
  const url = `https://www.amazon.co.uk/dp/${asin}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const sellerLink =
      document.querySelector('#sellerProfileTriggerId') ||
      document.querySelector('#merchantInfoFeature_feature_div a[href*="seller="]') ||
      document.querySelector('a[href*="seller="]');
    const soldByEl =
      document.querySelector('#merchantInfoFeature_feature_div') ||
      document.querySelector('[offer-display-feature-name="desktop-merchant-info"]');
    const fulfillerEl =
      document.querySelector('#fulfillerInfoFeature_feature_div') ||
      document.querySelector('[offer-display-feature-name="desktop-fulfiller-info"]');
    return {
      title: document.querySelector('#productTitle')?.textContent?.trim(),
      sellerName: sellerLink?.textContent?.trim(),
      sellerHref: sellerLink?.getAttribute('href'),
      soldByText: soldByEl?.textContent?.trim(),
      fulfillerText: fulfillerEl?.textContent?.trim(),
      merchantInfo: document.querySelector('#merchant-info')?.textContent?.trim(),
    };
  });

  console.log(JSON.stringify(info, null, 2));
} finally {
  await browser.close();
}
