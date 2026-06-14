import {
  buildOfferListingUrl,
  buildProductUrl,
  buildSellerUrl,
  getConfig,
  gotoWithRetry,
} from './browser.js';
import {
  filterOffersByFulfillment,
  parseAllOffersFromPage,
  parseBuyBoxMerchant,
} from '../filters/fbm.js';

function formatProductOffers(product, matched) {
  return matched
    .filter((offer) => offer.sellerId)
    .map((offer) => ({
      ...product,
      fulfillment: offer.isFba ? 'FBA' : 'FBM',
      sellerId: offer.sellerId,
      sellerName: offer.sellerName,
      offerPrice: offer.price || product.price,
      condition: offer.condition || 'New',
      fulfillmentText: offer.fulfillmentText,
      sellerUrl: buildSellerUrl(offer.sellerId),
    }));
}

function offerFromSearchListing(product) {
  if (!product.sellerId || (!product.isFbm && !product.isFba)) return null;

  return {
    sellerId: product.sellerId,
    sellerName: product.sellerName || '',
    price: product.price || '',
    condition: 'New',
    fulfillmentText: product.listingFulfillmentText || product.deliveryText || '',
    shipsFrom: '',
    isFba: product.isFba,
    isFbm: product.isFbm,
  };
}

/**
 * Get product offers filtered by fulfillment type (FBM / FBA).
 * Order: search listing → product buy box → offer listing.
 */
export async function getProductOffers(page, product, fulfillmentTypes = ['FBM']) {
  let current = { ...product };
  const fromListing = offerFromSearchListing(current);
  if (fromListing) {
    const matched = filterOffersByFulfillment([fromListing], fulfillmentTypes);
    if (matched.length > 0) {
      console.log(`    Fulfillment from search listing: ${fromListing.isFba ? 'FBA' : 'FBM'}`);
      return { listings: formatProductOffers(current, matched), product: current };
    }
    if (current.isFbm || current.isFba) {
      console.log(
        `    Listing shows ${current.isFba ? 'FBA' : 'FBM'}, not in filter (${fulfillmentTypes.join('/')}), skipping`
      );
      return { listings: [], product: current };
    }
  }

  const buyBox = await scrapeBuyBoxMerchant(page, current.asin);
  const merchant = parseBuyBoxMerchant(buyBox);
  if (buyBox.deliveryText) {
    current = { ...current, deliveryText: buyBox.deliveryText };
  }
  if (merchant) {
    const matched = filterOffersByFulfillment(
      [
        {
          sellerId: merchant.sellerId,
          sellerName: merchant.sellerName,
          price: current.price || '',
          condition: 'New',
          fulfillmentText: merchant.fulfillmentText,
          shipsFrom: '',
          isFba: merchant.isFba,
          isFbm: merchant.isFbm,
        },
      ],
      fulfillmentTypes
    );
    if (matched.length > 0) {
      console.log(`    Fulfillment from buy box: ${merchant.isFba ? 'FBA' : 'FBM'}`);
      return { listings: formatProductOffers(current, matched), product: current };
    }
  }

  const offers = await scrapeOfferListing(page, current.asin);
  const matched = filterOffersByFulfillment(parseAllOffersFromPage(offers), fulfillmentTypes);
  if (matched.length > 0) {
    console.log(`    Fulfillment from offer listing: ${matched.map((o) => (o.isFba ? 'FBA' : 'FBM')).join(', ')}`);
  }
  return { listings: formatProductOffers(current, matched), product: current };
}

/** @deprecated use getProductOffers */
export async function getFbmSellers(page, product) {
  return getProductOffers(page, product, ['FBM']);
}

async function scrapeOfferListing(page, asin) {
  const url = buildOfferListingUrl(asin);
  console.log(`    Checking offers: ${url}`);

  await gotoWithRetry(page, url);
  const settleMs = getConfig().pageSettleMs;
  if (settleMs > 0) {
    await page.waitForTimeout(Math.min(settleMs, 600));
  }

  const offers = await page.evaluate(() => {
    const results = [];

    function pickSellerLink(root) {
      const links = [...root.querySelectorAll('a[href*="seller="], a[href*="/sp?"]')];
      const generic = /^(details|seller profile|see all)$/i;
      const preferred = links.find((link) => {
        const href = link.getAttribute('href') || '';
        const text = link.textContent?.trim() || '';
        return (
          !generic.test(text) &&
          /merch_name|dp_merchant_link|olp_merch|at-a-glance|\/sp\?/i.test(href)
        );
      });
      if (preferred) return preferred;
      return links.find((link) => !generic.test(link.textContent?.trim() || '')) || links[0] || null;
    }

    function sellerNameFromSoldBy(soldBy) {
      const match = soldBy?.match(/sold\s+by\s+(.+?)(?:\s+Seller\s+rating|\s*$)/i);
      return match ? match[1].trim() : '';
    }

    const offerBlocks = document.querySelectorAll(
      '#aod-offer-list .aod-information-block, #aod-container .aod-information-block, #aod-pinned-offer .aod-information-block, .a-row.a-spacing-mini.olpOffer'
    );

    const blocks =
      offerBlocks.length > 0
        ? offerBlocks
        : document.querySelectorAll('#aod-offer, #aod-pinned-offer, .olpOffer');

    for (const block of blocks) {
      const text = block.textContent || '';

      const sellerLink = pickSellerLink(block);
      const href = sellerLink?.getAttribute('href') || '';
      const sellerIdMatch = href.match(/seller=([A-Z0-9]+)/i);
      const sellerId = sellerIdMatch ? sellerIdMatch[1] : null;
      const soldBy =
        block.querySelector('#aod-offer-soldBy')?.textContent?.trim() ||
        block.querySelector('[id*="soldBy"]')?.textContent?.trim() ||
        '';
      const sellerName =
        sellerLink?.textContent?.trim() || sellerNameFromSoldBy(soldBy) || '';

      const price =
        block.querySelector('.a-price .a-offscreen')?.textContent?.trim() ||
        block.querySelector('.a-color-price')?.textContent?.trim() ||
        '';

      const condition =
        block.querySelector('#aod-offer-heading h5')?.textContent?.trim() ||
        block.querySelector('.olpCondition')?.textContent?.trim() ||
        'New';

      const shippedBy =
        block.querySelector('#aod-offer-shipsFrom')?.textContent?.trim() ||
        block.querySelector('.aod-fulfillment-column')?.textContent?.trim() ||
        '';
      const fulfillmentText = [shippedBy, soldBy].filter(Boolean).join(' | ');

      results.push({
        sellerId,
        sellerName,
        price,
        condition,
        fulfillmentText,
        shipsFrom: shippedBy,
        soldBy,
      });
    }

    if (results.length === 0) {
      const pinned = document.querySelector('#aod-pinned-offer');
      if (pinned) {
        const sellerLink = pickSellerLink(pinned);
        const href = sellerLink?.getAttribute('href') || '';
        const sellerIdMatch = href.match(/seller=([A-Z0-9]+)/i);
        const shippedBy =
          pinned.querySelector('#aod-offer-shipsFrom')?.textContent?.trim() ||
          document.querySelector('#aod-offer-shipsFrom')?.textContent?.trim() ||
          '';
        const soldBy =
          pinned.querySelector('#aod-offer-soldBy')?.textContent?.trim() ||
          document.querySelector('#aod-offer-soldBy')?.textContent?.trim() ||
          '';
        const price =
          pinned.querySelector('.a-price .a-offscreen')?.textContent?.trim() ||
          pinned.querySelector('.a-color-price')?.textContent?.trim() ||
          '';

        if (sellerIdMatch || shippedBy || soldBy) {
          results.push({
            sellerId: sellerIdMatch ? sellerIdMatch[1] : null,
            sellerName:
              sellerLink?.textContent?.trim() || sellerNameFromSoldBy(soldBy) || '',
            price,
            condition: 'New',
            fulfillmentText: [shippedBy, soldBy].filter(Boolean).join(' | '),
            shipsFrom: shippedBy,
            soldBy,
          });
        }
      }
    }

    if (results.length === 0) {
      const sellerLinks = document.querySelectorAll('a[href*="seller="]');
      for (const link of sellerLinks) {
        const href = link.getAttribute('href') || '';
        const match = href.match(/seller=([A-Z0-9]+)/i);
        if (!match) continue;

        const parent = link.closest('.a-section, .a-row, div') || link.parentElement;
        const contextText = parent?.textContent || '';

        results.push({
          sellerId: match[1],
          sellerName: link.textContent?.trim() || '',
          price: '',
          condition: 'New',
          fulfillmentText: contextText.slice(0, 400),
          shipsFrom: '',
          soldBy: link.textContent?.trim() || '',
        });
      }
    }

    return results;
  });

  return offers;
}

async function scrapeBuyBoxMerchant(page, asin) {
  const url = buildProductUrl(asin);

  await gotoWithRetry(page, url);
  const settleMs = getConfig().pageSettleMs;
  if (settleMs > 0) {
    await page.waitForTimeout(Math.min(settleMs, 600));
  }

  const merchantInfo = await page.evaluate(() => {
    const fulfilledByEl =
      document.querySelector('#fulfillerInfoFeature_feature_div') ||
      document.querySelector('[offer-display-feature-name="desktop-fulfiller-info"]') ||
      document.querySelector('#tabular-buybox [data-feature-name="fulfillerInfo"]');

    const soldByEl =
      document.querySelector('#merchantInfoFeature_feature_div') ||
      document.querySelector('[offer-display-feature-name="desktop-merchant-info"]') ||
      document.querySelector('#tabular-buybox [data-feature-name="merchantInfo"]');

    const fulfilledByText = fulfilledByEl?.textContent?.trim() || '';
    const soldByText = soldByEl?.textContent?.trim() || '';

    const merchantBlock =
      document.querySelector('#merchant-info') ||
      document.querySelector('#tabular-buybox') ||
      soldByEl?.parentElement;

    const text = [fulfilledByText, soldByText, merchantBlock?.textContent?.trim()]
      .filter(Boolean)
      .join(' | ');

    const sellerLink =
      document.querySelector('#sellerProfileTriggerId') ||
      document.querySelector('#merchantInfoFeature_feature_div a[href*="seller="]') ||
      document.querySelector('a[href*="seller="]');

    const href = sellerLink?.getAttribute('href') || '';
    const sellerIdMatch = href.match(/seller=([A-Z0-9]+)/i);

    const deliveryText = (() => {
      const recipe =
        document.querySelector('[data-cy="delivery-recipe"]') ||
        document.querySelector('[data-cy="delivery-block"]');
      if (recipe?.textContent?.trim()) return recipe.textContent.trim();

      const block = document.querySelector('#mir-layout-DELIVERY_BLOCK');
      if (block) {
        const line =
          block.querySelector('[data-cy="delivery-recipe"], [data-cy="delivery-block"]') ||
          block.querySelector('#deliveryBlockMessage, #ddmDeliveryMessage');
        if (line?.textContent?.trim()) return line.textContent.trim();
        const raw = block.textContent?.trim() || '';
        return raw.split(/\.\s+(?:Details|Arrives)/i)[0].trim();
      }

      return (
        document.querySelector('#deliveryBlockMessage')?.textContent?.trim() ||
        document.querySelector('#ddmDeliveryMessage')?.textContent?.trim() ||
        ''
      );
    })();

    return {
      text,
      fulfilledByText,
      soldByText,
      sellerId: sellerIdMatch ? sellerIdMatch[1] : null,
      sellerName: sellerLink?.textContent?.trim() || '',
      deliveryText,
    };
  });

  return merchantInfo;
}
