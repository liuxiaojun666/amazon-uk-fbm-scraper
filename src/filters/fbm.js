/**
 * FBM / FBA fulfillment detection helpers for Amazon UK.
 */

const FBA_PATTERNS = [
  /fulfil+ed by amazon/i,
  /fulfil+ment by amazon/i,
  /amazon\s+fulfil+ment/i,
  /ships from amazon/i,
  /dispatched from amazon/i,
  /shipped by amazon/i,
];

const FBM_EXPLICIT_PATTERNS = [
  /dispatched from and sold by/i,
  /dispatches from and sold by/i,
  /ships from and sold by/i,
  /shipper\s*\/\s*seller/i,
];

const MERCHANT_SHIPS_FROM_PATTERN = /dispatches?\s+from|ships?\s+from/i;

export function isFbaText(text) {
  if (!text) return false;
  return FBA_PATTERNS.some((pattern) => pattern.test(text));
}

export function isFbmExplicitText(text) {
  if (!text) return false;
  if (isFbaText(text)) return false;
  return FBM_EXPLICIT_PATTERNS.some((pattern) => pattern.test(text));
}

/** Merchant ships (not Amazon): "Dispatches from SellerName" */
export function isMerchantShipsFromText(text) {
  if (!text) return false;
  if (isFbaText(text) || /\bamazon\b/i.test(text)) return false;
  return MERCHANT_SHIPS_FROM_PATTERN.test(text);
}

/** @deprecated */
export function isFbmText(text) {
  return isFbmExplicitText(text);
}

/**
 * Classify fulfillment from offer / buy box fields.
 * FBA: explicit Amazon fulfillment text.
 * FBM: explicit "dispatched/ships from and sold by" (merchant ships).
 * Never infer FBM from sellerId alone — FBA also has a seller.
 */
export function classifyFulfillment({ fulfillmentText = '', shipsFrom = '', soldBy = '' } = {}) {
  const shipsText = shipsFrom || '';
  const soldText = soldBy || '';
  const fullText = [shipsText, soldText, fulfillmentText].filter(Boolean).join(' ');

  let isFba = isFbaText(fullText) || isFbaText(shipsText);
  let isFbm =
    !isFba &&
    (isFbmExplicitText(fullText) ||
      (isMerchantShipsFromText(shipsText) && /sold\s+by/i.test(soldText || fullText)));

  // UK FBA: "Sold by Seller" + ships/fulfilled by Amazon (separate lines)
  if (!isFba && !isFbm && /sold by/i.test(soldText || fullText)) {
    if (isFbaText(shipsText) || /\bamazon\b/i.test(shipsText)) {
      isFba = true;
    }
  }

  return { isFba, isFbm, fullText };
}

export function parseFulfillmentOption(value) {
  if (!value) return ['FBM'];

  const parts = value
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (parts.includes('ALL')) return ['FBM', 'FBA'];
  if (parts.includes('FBM') && parts.includes('FBA')) return ['FBM', 'FBA'];

  const valid = parts.filter((t) => t === 'FBM' || t === 'FBA');
  return valid.length > 0 ? valid : ['FBM'];
}

export function matchesFulfillmentType(offer, types) {
  const normalized = types.map((t) => t.toUpperCase());
  if (offer.isFba && normalized.includes('FBA')) return true;
  if (offer.isFbm && normalized.includes('FBM')) return true;
  return false;
}

export function parseAllOffersFromPage(offers) {
  return offers
    .map((offer) => {
      const { isFba, isFbm, fullText } = classifyFulfillment(offer);

      return {
        sellerId: offer.sellerId || null,
        sellerName: offer.sellerName || '',
        price: offer.price || '',
        condition: offer.condition || '',
        fulfillmentText: fullText || offer.fulfillmentText || '',
        shipsFrom: offer.shipsFrom || '',
        soldBy: offer.soldBy || '',
        isFba,
        isFbm,
      };
    })
    .filter((offer) => offer.isFba || offer.isFbm);
}

export function filterOffersByFulfillment(offers, types) {
  return offers.filter((offer) => matchesFulfillmentType(offer, types));
}

/** @deprecated use parseAllOffersFromPage */
export function parseOffersFromPage(offers) {
  return filterOffersByFulfillment(parseAllOffersFromPage(offers), ['FBM']).filter(
    (offer) => offer.sellerId
  );
}

export function parseBuyBoxMerchant(merchantInfo) {
  if (!merchantInfo) return null;

  const { text, sellerId, sellerName, fulfilledByText, soldByText } = merchantInfo;
  const { isFba, isFbm, fullText } = classifyFulfillment({
    fulfillmentText: text,
    shipsFrom: fulfilledByText,
    soldBy: soldByText,
  });

  if (!isFba && !isFbm) return null;
  if (!sellerId) return null;

  return {
    sellerId,
    sellerName: sellerName || '',
    fulfillmentText: fullText,
    isFba,
    isFbm,
  };
}

/**
 * Classify fulfillment from Amazon UK search result card (no extra page load).
 * Uses card text, delivery line, and merchantId from the listing form.
 */
export function parseSearchListingFulfillment({
  cardText = '',
  deliveryText = '',
  sellerId = '',
} = {}) {
  const { isFba, isFbm, fullText } = classifyFulfillment({ fulfillmentText: cardText });

  if (isFba || isFbm) {
    return { sellerId: sellerId || null, isFba, isFbm, fulfillmentText: fullText };
  }

  // UK search cards: paid merchant delivery (not FREE) usually indicates FBM buy-box offer
  if (
    sellerId &&
    deliveryText &&
    /[£$€]\s*[\d,.]+\s+delivery/i.test(deliveryText) &&
    !/free\s+delivery/i.test(deliveryText) &&
    !isFbaText(deliveryText)
  ) {
    return {
      sellerId,
      isFba: false,
      isFbm: true,
      fulfillmentText: deliveryText,
    };
  }

  return { sellerId: sellerId || null, isFba: false, isFbm: false, fulfillmentText: '' };
}
