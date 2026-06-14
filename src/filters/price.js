/**
 * Parse price string from Amazon (e.g. "£19.99", "HKD 96.24") to a number.
 */
export function parsePrice(priceText) {
  if (!priceText || typeof priceText !== 'string') return null;

  const normalized = priceText.replace(/,/g, '').trim();
  const match = normalized.match(/([\d]+(?:\.\d+)?)/);
  if (!match) return null;

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function matchesMinPrice(product, minPrice) {
  if (minPrice == null) return true;
  const value = product.priceValue ?? parsePrice(product.price);
  if (value == null) return true;
  return value >= minPrice;
}

export function matchesMaxPrice(product, maxPrice) {
  if (maxPrice == null) return true;
  const value = product.priceValue ?? parsePrice(product.price);
  if (value == null) return true;
  return value <= maxPrice;
}

export function matchesMinDiscount(product, minDiscount) {
  if (minDiscount == null) return true;
  if (product.discountPercent == null) return false;
  return product.discountPercent >= minDiscount;
}

export function filterProductsByPrice(products, { minPrice, maxPrice, minDiscount } = {}) {
  return products.filter(
    (product) =>
      matchesMinPrice(product, minPrice) &&
      matchesMaxPrice(product, maxPrice) &&
      matchesMinDiscount(product, minDiscount)
  );
}

export function enrichProductPrice(product) {
  return {
    ...product,
    priceValue: parsePrice(product.price),
    currencyGbp: typeof product.price === 'string' && product.price.includes('£'),
  };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

/** Drop values that are far above the bulk of the list (handles RUB million outliers). */
function trimOutliers(prices, { tailFraction = 0.35, ratioCap = 12 } = {}) {
  const sorted = [...prices].filter((p) => p > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return sorted;
  if (sorted.length < 4) return sorted;

  const median = sorted[Math.floor(sorted.length / 2)];
  const upper = median * ratioCap;
  const trimmed = sorted.filter((p) => p <= upper);
  const pool = trimmed.length >= 2 ? trimmed : sorted;

  const skip = Math.floor(pool.length * tailFraction);
  return pool.slice(0, Math.max(2, pool.length - skip));
}

/**
 * Robust min/max from sorted price probes — drops million-pound/RUB outliers.
 */
export function computeRobustPriceRange(ascPrices, descPrices) {
  const low = trimOutliers(ascPrices, { tailFraction: 0.2, ratioCap: 8 }).sort((a, b) => a - b);

  if (low.length === 0) return null;

  const ascMax = low[low.length - 1];
  const ascMin = low[0];
  const descPositive = descPrices.filter((p) => p > 0);
  const descMin = descPositive.length ? Math.min(...descPositive) : null;

  let high = trimOutliers(descPrices, { tailFraction: 0.35, ratioCap: 8 }).sort((a, b) => b - a);

  // Desc-sorted page often lists unrelated million-unit outliers (common with non-UK IP)
  if (high.length === 0 || (descMin != null && descMin > ascMax * 15)) {
    const min = percentile(low, 15) ?? ascMin;
    const max = Math.max(ascMax * 4, min * 8);
    const mid = (min + max) / 2;
    return {
      min,
      max,
      mid,
      rawMax: descPositive.length ? Math.max(...descPositive) : null,
      inferred: true,
    };
  }

  if (high.length === 0) return null;

  const min = percentile(low, 15) ?? low[0];
  const max = high[Math.min(4, high.length - 1)] ?? high[0];
  const median = percentile(high, 50) ?? max;

  let cappedMax = max;
  if (cappedMax > median * 8) {
    cappedMax = median * 3;
  }

  if (cappedMax <= min) return null;

  const mid = (min + cappedMax) / 2;
  return { min, max: cappedMax, mid, rawMax: descPositive.length ? Math.max(...descPositive) : null };
}
