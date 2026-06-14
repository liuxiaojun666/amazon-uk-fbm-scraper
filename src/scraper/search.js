import { buildSearchUrl, buildProductUrl, delay, getConfig, gotoWithRetry } from './browser.js';
import { parseSearchListingFulfillment } from '../filters/fbm.js';
import { extractSellerNameFromSearchCard } from '../filters/chinese-seller.js';
import {
  enrichProductPrice,
  matchesMinPrice,
  matchesMaxPrice,
} from '../filters/price.js';
import {
  enrichProductDelivery,
  describeDeliveryFilters,
  matchesMinDeliveryDays,
  matchesMaxDeliveryDays,
} from '../filters/delivery.js';

/**
 * Fetch a single search results page.
 */
export async function searchSinglePage(page, keyword, pageNum = 1, searchFilters = {}) {
  const url = buildSearchUrl(keyword, pageNum, searchFilters);
  console.log(`  Searching page ${pageNum}: ${url}`);

  await gotoWithRetry(page, url);
  const settleMs = getConfig().pageSettleMs;
  if (settleMs > 0) {
    await page.waitForTimeout(Math.min(settleMs, 600));
  }

  let products = await extractSearchResults(page, keyword);
  products = products
    .map(enrichProductPrice)
    .map((product) => enrichProductDelivery(product))
    .map(enrichSearchSellerName)
    .map(enrichListingFulfillment);

  const { passed, skipped } = partitionSearchResults(products, searchFilters);
  products = passed;

  const filterDesc = describeSearchFilters(searchFilters);
  if (filterDesc) {
    console.log(`  After filters (${filterDesc}): ${products.length} items (${skipped.length} filtered out)`);
  } else {
    console.log(`  Found ${products.length} items on page ${pageNum}`);
  }

  return { products, searchSkipped: skipped };
}

function enrichSearchSellerName(product) {
  const sellerNameFromLink = product.sellerNameFromLink || '';
  const sellerName =
    sellerNameFromLink && !/^(details|seller profile|see all)$/i.test(sellerNameFromLink)
      ? sellerNameFromLink
      : extractSellerNameFromSearchCard(product.cardText || '');

  const { sellerNameFromLink: _drop, ...rest } = product;
  return { ...rest, sellerName };
}

function enrichListingFulfillment(product) {
  const { cardText, ...rest } = product;
  const listing = parseSearchListingFulfillment({
    cardText,
    deliveryText: product.deliveryText,
    sellerId: product.sellerId,
  });

  return {
    ...rest,
    sellerId: listing.sellerId || product.sellerId || null,
    isFba: listing.isFba,
    isFbm: listing.isFbm,
    listingFulfillment: listing.isFbm ? 'FBM' : listing.isFba ? 'FBA' : null,
    listingFulfillmentText: listing.fulfillmentText,
  };
}

function describePriceFilters({ minPrice, maxPrice, minDiscount } = {}) {
  const parts = [];
  if (minPrice != null) parts.push(`min £${minPrice}`);
  if (maxPrice != null) parts.push(`max £${maxPrice}`);
  if (minDiscount != null) parts.push(`discount >= ${minDiscount}%`);
  return parts.join(', ');
}

function describeSearchFilters(filters = {}) {
  const parts = [
    describePriceFilters(filters),
    describeDeliveryFilters(filters),
  ].filter(Boolean);
  return parts.join(', ');
}

export function getSearchFilterSkipReason(
  product,
  { minPrice, maxPrice, minDeliveryDays, maxDeliveryDays } = {}
) {
  if (!matchesMinPrice(product, minPrice)) {
    return minPrice != null ? `price below min (£${minPrice})` : 'price below minimum';
  }
  if (!matchesMaxPrice(product, maxPrice)) {
    return maxPrice != null ? `price above max (£${maxPrice})` : 'price above maximum';
  }
  if (!matchesMinDeliveryDays(product, minDeliveryDays)) {
    return minDeliveryDays != null
      ? `delivery max below threshold (< ${minDeliveryDays} days)`
      : 'delivery max below threshold';
  }
  if (!matchesMaxDeliveryDays(product, maxDeliveryDays)) {
    return maxDeliveryDays != null
      ? `delivery min above threshold (> ${maxDeliveryDays} days)`
      : 'delivery min above threshold';
  }
  return null;
}

export function partitionSearchResults(products, searchFilters = {}) {
  const passed = [];
  const skipped = [];

  for (const product of products) {
    const skipReason = getSearchFilterSkipReason(product, searchFilters);
    if (skipReason) {
      skipped.push({ product, skipReason });
    } else {
      passed.push(product);
    }
  }

  return { passed, skipped };
}

/**
 * Search Amazon UK by keyword across multiple pages (batch mode).
 */
export async function searchByKeyword(page, keyword, pages = 1, searchFilters = {}) {
  const results = [];
  const seenAsins = new Set();

  for (let pageNum = 1; pageNum <= pages; pageNum++) {
    const { products: pageResults } = await searchSinglePage(page, keyword, pageNum, searchFilters);
    let newCount = 0;

    for (const item of pageResults) {
      if (!seenAsins.has(item.asin)) {
        seenAsins.add(item.asin);
        results.push(item);
        newCount++;
      }
    }

    console.log(`  (${newCount} new, ${results.length} total)`);

    if (pageNum < pages) {
      await delay();
    }
  }

  return results;
}

export async function extractSearchResults(page, keyword) {
  const baseUrl = buildProductUrl('').replace(/\/dp\/$/, '');

  return page.evaluate(({ kw, base }) => {
    const items = [];
    const cards = document.querySelectorAll(
      '[data-component-type="s-search-result"][data-asin]:not([data-asin=""])'
    );

    for (const card of cards) {
      const asin = card.getAttribute('data-asin');
      if (!asin) continue;

      const titleEl =
        card.querySelector('h2 a span') ||
        card.querySelector('h2 span') ||
        card.querySelector('.a-text-normal');
      const title = titleEl?.textContent?.trim() || '';

      const priceWhole = card.querySelector('.a-price-whole')?.textContent?.trim();
      const priceFraction = card.querySelector('.a-price-fraction')?.textContent?.trim();
      const priceOffscreen = card.querySelector('.a-price .a-offscreen')?.textContent?.trim();
      const price =
        priceOffscreen ||
        (priceWhole ? `£${priceWhole}${priceFraction || ''}` : '');

      const listPriceText =
        card.querySelector('.a-price[data-a-strike="true"] .a-offscreen')?.textContent?.trim() ||
        card.querySelector('.a-text-price .a-offscreen')?.textContent?.trim() ||
        '';

      const sellerId =
        card.querySelector('input[name="merchantId"]')?.value ||
        card.querySelector('[data-csa-c-merchant-id]')?.getAttribute('data-csa-c-merchant-id') ||
        card.querySelector('a[href*="seller="]')?.getAttribute('href')?.match(/seller=([A-Z0-9]+)/i)?.[1] ||
        null;

      const sellerLink = card.querySelector('a[href*="seller="], a[href*="/sp?"]');
      const sellerNameFromLink = sellerLink?.textContent?.trim() || '';
      const cardText = (card.textContent || '').replace(/\s+/g, ' ').trim();

      const discountMatch = cardText.match(/(\d{1,2})%\s*off/i);
      let discountPercent = discountMatch ? Number(discountMatch[1]) : null;

      if (discountPercent == null && price && listPriceText) {
        const current = parseFloat((price.match(/([\d.]+)/) || [])[1]);
        const list = parseFloat((listPriceText.match(/([\d.]+)/) || [])[1]);
        if (current > 0 && list > current) {
          discountPercent = Math.round(((list - current) / list) * 100);
        }
      }

      const ratingText = card.querySelector('.a-icon-alt')?.textContent?.trim() || '';
      const ratingMatch = ratingText.match(/([\d.]+)\s+out of/);
      const rating = ratingMatch ? ratingMatch[1] : '';

      const reviewCount =
        card.querySelector('.a-size-base.s-underline-text')?.textContent?.trim() ||
        card.querySelector('[aria-label*="ratings"]')?.getAttribute('aria-label')?.match(/([\d,]+)/)?.[1] ||
        '';

      const deliveryText =
        card.querySelector('[data-cy="delivery-recipe"]')?.textContent?.trim() ||
        card.querySelector('[data-cy="delivery-block"]')?.textContent?.trim() ||
        '';

      items.push({
        keyword: kw,
        asin,
        title,
        price,
        listPrice: listPriceText,
        discountPercent,
        rating,
        reviewCount,
        productUrl: `${base}/dp/${asin}`,
        sellerId,
        sellerNameFromLink,
        deliveryText,
        cardText,
      });
    }

    return items;
  }, { kw: keyword, base: baseUrl });
}
