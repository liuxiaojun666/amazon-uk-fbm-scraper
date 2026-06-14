import dotenv from 'dotenv';
import { createBrowser } from '../src/scraper/browser.js';
import { extractSearchResults } from '../src/scraper/search.js';
import { enrichProductDelivery } from '../src/filters/delivery.js';
import { parseSearchListingFulfillment } from '../src/filters/fbm.js';

dotenv.config();

const keyword = process.argv[2] || 'tent';
const { browser, page } = await createBrowser({ headless: true });

try {
  await setDeliveryPostcode(page, 'SW1A 1AA');
  await page.goto(`https://www.amazon.co.uk/s?k=${encodeURIComponent(keyword)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(2000);

  let items = await extractSearchResults(page, keyword);
  items = items.map(enrichProductDelivery).map((product) => {
    const listing = parseSearchListingFulfillment({
      cardText: product.cardText,
      deliveryText: product.deliveryText,
      sellerId: product.sellerId,
    });
    return { ...product, ...listing, deliveryDaysMax: enrichProductDelivery(product).deliveryDaysMax };
  });

  const slow = items.filter((i) => (i.deliveryDaysMax ?? 0) >= 14).slice(0, 5);
  console.log('\nSlow delivery items:', slow.map((i) => ({ asin: i.asin, sellerId: i.sellerId, delivery: i.deliveryText, isFbm: i.isFbm })));


  const domInfo = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-component-type="s-search-result"][data-asin]:not([data-asin=""])')].slice(0, 10);
    return cards.map((card) => {
      const asin = card.getAttribute('data-asin');
      const sellerLink = card.querySelector('a[href*="seller="]');
      const soldByEl =
        card.querySelector('[data-csa-c-content-id="sold-by"]') ||
        card.querySelector('.a-row.a-size-base.a-color-secondary');
      const merchantEl = card.querySelector('[data-csa-c-merchant-id]');
      const spans = [...card.querySelectorAll('span, a')].filter((el) => /sold by|dispatches from|shipper/i.test(el.textContent || '')).slice(0, 3).map((el) => el.textContent?.trim());
      return {
        asin,
        sellerLink: sellerLink ? { text: sellerLink.textContent?.trim(), href: sellerLink.getAttribute('href') } : null,
        soldByEl: soldByEl?.textContent?.trim(),
        merchantId: merchantEl?.getAttribute('data-csa-c-merchant-id'),
        soldBySpans: spans,
      };
    });
  });

  const deepDom = await page.evaluate(() => {
    const card = document.querySelector('[data-component-type="s-search-result"][data-asin]:not([data-asin=""])');
    if (!card) return null;
    const allText = [...card.querySelectorAll('*')].map((el) => ({
      tag: el.tagName,
      class: el.className?.slice?.(0, 80) || '',
      text: (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 ? el.textContent : '')?.trim(),
      attrs: [...el.attributes].map((a) => `${a.name}=${a.value?.slice(0, 60)}`).join(' '),
    })).filter((x) => x.text && /sold|seller|ship|merchant|dispatches/i.test(x.text));
    const links = [...card.querySelectorAll('a[href*="seller"], a[href*="/sp?"]')].map((a) => ({
      text: a.textContent?.trim(),
      href: a.getAttribute('href'),
    }));
    return { asin: card.getAttribute('data-asin'), soldTexts: allText, sellerLinks: links };
  });
  console.log('\nDeep DOM sample:', JSON.stringify(deepDom, null, 2));

  for (const row of domInfo) {
    console.log(JSON.stringify(row, null, 0));
  }

  const fbmHints = items.map((item) => ({
    asin: item.asin,
    sellerId: item.sellerId,
    isFbm: item.cardText.match(/dispatches from and sold by|shipper\s*\/\s*seller/i) ? true : /[£$€]\s*[\d,.]+\s+delivery/i.test(item.deliveryText || '') && !/free\s+delivery/i.test(item.deliveryText || ''),
    deliveryText: item.deliveryText,
    china: /china|中国|CN\b/i.test(item.cardText + item.deliveryText),
    soldBy: item.cardText.match(/(?:sold by|dispatches from and sold by|shipper\s*\/\s*seller)\s+([^|£]+)/i)?.[1]?.trim(),
  }));
  console.log('\nFBM/China hints:', JSON.stringify(fbmHints.slice(0, 12), null, 2));

  for (const item of items.slice(0, 10)) {
    const soldBy = item.cardText.match(
      /(?:sold by|dispatches from and sold by|shipper\s*\/\s*seller)\s+([^|]+?)(?:\s+FREE|\s+£|\s+Delivery|\s+Fulfilled|\s+Sold|\s+Add|\s+\d|$)/i
    );
    console.log('---');
    console.log('asin:', item.asin);
    console.log('sellerId:', item.sellerId);
    console.log('soldBy match:', soldBy?.[1]?.trim());
    console.log('card snippet:', item.cardText.slice(0, 320));
  }
} finally {
  await browser.close();
}
