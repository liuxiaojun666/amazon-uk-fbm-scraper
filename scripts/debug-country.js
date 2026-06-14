import { createBrowser } from '../src/scraper/browser.js';
import { gotoWithRetry, getConfig } from '../src/scraper/browser.js';
import { acceptCookiesOnPage } from '../src/scraper/location.js';

// quick inline since getPageCsrfToken is not exported - duplicate
async function csrf(page) {
  return page.evaluate(() =>
    document.querySelector("input[name='anti-csrftoken-a2z']")?.value ||
    document.querySelector('meta[name="anti-csrftoken-a2z"]')?.content || ''
  );
}

const { browser, page } = await createBrowser({ headless: true });
const base = getConfig().baseUrl;
await gotoWithRetry(page, base);
await acceptCookiesOnPage(page);
const token = await csrf(page);

const result = await page.evaluate(async ({ base, token }) => {
  const res = await fetch(`${base}/portal-migration/hz/glow/address-change?actionSource=glow`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'anti-csrftoken-a2z': token,
    },
    body: JSON.stringify({
      locationType: 'COUNTRY',
      district: 'GB',
      countryCode: 'GB',
      storeContext: 'generic',
      deviceType: 'web',
      pageType: 'Gateway',
      actionSource: 'glow',
    }),
  });
  const text = await res.text();
  let label = '';
  try {
    const lr = await fetch(`${base}/portal-migration/hz/glow/get-location-label?storeContext=generic&pageType=Gateway&actionSource=desktop-modal`, { credentials: 'include' });
    label = JSON.stringify(await lr.json());
  } catch (e) {
    label = e.message;
  }
  return { status: res.status, ok: res.ok, text: text.slice(0, 400), label };
}, { base, token });

console.log(result);
await page.reload();
await page.waitForTimeout(1500);
console.log('UI label:', await page.locator('#glow-ingress-line2').textContent());

await browser.close();
