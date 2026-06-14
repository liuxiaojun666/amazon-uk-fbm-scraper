import { createBrowser } from '../src/scraper/browser.js';
import { setUkAddressViaApi, setDeliveryPostcode } from '../src/scraper/location.js';

const { browser, page } = await createBrowser({ headless: true });

console.log('--- API only ---');
const api = await setUkAddressViaApi(page, 'SW1A 1AA');
console.log('API result:', api);

console.log('\n--- Full setDeliveryPostcode ---');
const result = await setDeliveryPostcode(page, 'SW1A 1AA');
console.log('Result:', result);
console.log(
  'Label:',
  await page.locator('#glow-ingress-line1, #glow-ingress-line2').allTextContents()
);

await browser.close();
