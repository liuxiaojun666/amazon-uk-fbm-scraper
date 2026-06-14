import fs from 'fs';
import path from 'path';
import { createBrowser, delay, getConfig, buildSellerUrl } from './scraper/browser.js';
import { searchSinglePage } from './scraper/search.js';
import { getProductOffers } from './scraper/product.js';
import { parseFulfillmentOption } from './filters/fbm.js';
import { getSellerProfile, readSellerCache } from './scraper/seller.js';
import { buildProvinceFilter, evaluateProvinceFilter } from './filters/province.js';
import { classifySellerOrigin } from './filters/chinese-seller.js';
import { formatDeliveryDays, formatDeliverySummary, enrichProductDelivery } from './filters/delivery.js';
import { exportResults } from './storage/export.js';
import { setDeliveryPostcode } from './scraper/location.js';
import { checkProxyCountry } from './utils/proxy-check.js';
import { createLogger } from './lib/logger.js';

function checkAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException('Scrape cancelled', 'AbortError');
  }
}

function buildSkipRecord(product, keyword, skipReason, overrides = {}) {
  const deliveryInfo = enrichProductDelivery(product);
  const record = {
    keyword,
    asin: product.asin,
    title: product.title,
    price: overrides.price ?? product.price ?? '',
    delivery: formatDeliveryDays(deliveryInfo),
    deliveryText: deliveryInfo.deliveryText || '',
    deliveryDaysMin: deliveryInfo.deliveryDaysMin ?? null,
    deliveryDaysMax: deliveryInfo.deliveryDaysMax ?? null,
    fulfillment: overrides.fulfillment ?? product.listingFulfillment ?? '',
    sellerId: overrides.sellerId ?? product.sellerId ?? '',
    sellerName: overrides.sellerName ?? product.sellerName ?? '',
    businessName: overrides.businessName ?? '',
    businessAddress: overrides.businessAddress ?? '',
    matchedProvince: overrides.matchedProvince ?? '',
    productUrl: product.productUrl,
    sellerUrl: '',
    scrapedAt: new Date().toISOString(),
    skipReason,
    ...overrides,
  };
  record.sellerUrl = record.sellerId ? buildSellerUrl(record.sellerId) : '';
  return record;
}

function classifyProductSellerOrigin(product, cacheDir) {
  if (product.sellerId && cacheDir) {
    const cached = readSellerCache(product.sellerId, cacheDir);
    if (cached) {
      const origin = classifySellerOrigin({
        sellerName: cached.sellerName,
        businessAddress: cached.businessAddress,
      });
      if (origin !== 'unknown') return origin;
    }
  }

  return classifySellerOrigin({
    sellerName: product.sellerName,
    cardText: product.cardText,
  });
}

function getNonChineseSkipReason(product, cacheDir) {
  const origin = classifyProductSellerOrigin(product, cacheDir);
  if (origin !== 'non_chinese') return null;

  const label = product.sellerName || product.sellerId || product.asin;
  return `non-Chinese seller (${label})`;
}

/** @param {'search' | 'preScan' | 'product' | 'seller'} stage */
function reportSkip(onSkip, stats, record, stage = 'product') {
  stats.skippedCount++;
  if (stage === 'search') stats.searchFiltered++;
  else if (stage === 'preScan') stats.preScanSkipped++;
  else if (stage === 'seller') stats.sellerSkipped++;
  else stats.productScanSkipped++;
  onSkip(record);
}

function trackSearchAsin(stats, asin, seenAsins) {
  if (!asin || seenAsins.has(asin)) return;
  seenAsins.add(asin);
  stats.searchResultsSeen++;
}

async function scanProduct(page, product, keyword, scanOptions, stats, allResults, log, onResult, onSkip) {
  const { fulfillmentTypes, cacheDir } = scanOptions;
  const preSkipReason = getNonChineseSkipReason(product, cacheDir);
  if (preSkipReason) {
    log.log(`    Skip deep scan: ${preSkipReason}`);
    reportSkip(onSkip, stats, buildSkipRecord(product, keyword, preSkipReason), 'preScan');
    return 0;
  }

  stats.productsScanned++;
  log.log(`\n  [${stats.productsScanned}] ${product.asin} - ${product.title.slice(0, 60)}...`);

  let listings;
  let scannedProduct = product;
  try {
    ({ listings, product: scannedProduct } = await getProductOffers(page, product, fulfillmentTypes));
  } catch (error) {
    log.error(`    Offer check failed: ${error.message}`);
    stats.errors.push({ asin: product.asin, stage: 'offers', error: error.message });
    reportSkip(
      onSkip,
      stats,
      buildSkipRecord(product, keyword, `offer check failed: ${error.message}`),
      'product'
    );
    return 0;
  }

  const deliveryInfo = enrichProductDelivery(scannedProduct);
  const deliveryLabel = formatDeliverySummary(deliveryInfo);
  if (deliveryLabel) log.log(`    配送时效: ${deliveryLabel}`);

  if (listings.length === 0) {
    const reason = `no ${fulfillmentTypes.join('/')} offers`;
    log.log(`    No ${fulfillmentTypes.join('/')} offers found, skipping`);
    reportSkip(onSkip, stats, buildSkipRecord(product, keyword, reason), 'product');
    return 0;
  }

  const typeSummary = listings.map((l) => l.fulfillment).join(', ');
  log.log(`    Found ${listings.length} offer(s): ${typeSummary}`);
  stats.offersFound += listings.length;

  const seenSellers = new Set();
  let matches = 0;

  for (const listing of listings) {
    const sellerKey = `${listing.fulfillment}:${listing.sellerId}`;
    if (seenSellers.has(sellerKey)) continue;
    seenSellers.add(sellerKey);

    const listingOrigin = classifySellerOrigin({
      sellerName: listing.sellerName,
      businessAddress: readSellerCache(listing.sellerId, cacheDir)?.businessAddress,
    });
    if (listingOrigin === 'non_chinese') {
      const reason = `non-Chinese seller (${listing.sellerName || listing.sellerId})`;
      log.log(`    Skip seller profile: ${reason}`);
      reportSkip(
        onSkip,
        stats,
        buildSkipRecord(product, keyword, reason, {
          price: listing.offerPrice || product.price,
          fulfillment: listing.fulfillment,
          sellerId: listing.sellerId,
          sellerName: listing.sellerName,
        }),
        'seller'
      );
      continue;
    }

    stats.sellersChecked++;

    let profile;
    try {
      profile = await getSellerProfile(page, listing.sellerId);
    } catch (error) {
      log.error(`    Seller profile failed (${listing.sellerId}): ${error.message}`);
      stats.errors.push({ sellerId: listing.sellerId, stage: 'seller', error: error.message });
      reportSkip(
        onSkip,
        stats,
        buildSkipRecord(product, keyword, `seller profile failed: ${error.message}`, {
          price: listing.offerPrice || product.price,
          fulfillment: listing.fulfillment,
          sellerId: listing.sellerId,
          sellerName: listing.sellerName,
        }),
        'seller'
      );
      continue;
    }

    const { export: shouldExport, matchedProvince } = evaluateProvinceFilter(
      profile.businessAddress,
      scanOptions.provinceFilter
    );

    const record = {
      keyword,
      asin: product.asin,
      title: product.title,
      price: listing.offerPrice || product.price,
      delivery: formatDeliveryDays(deliveryInfo),
      deliveryText: deliveryInfo.deliveryText || '',
      deliveryDaysMin: deliveryInfo.deliveryDaysMin ?? null,
      deliveryDaysMax: deliveryInfo.deliveryDaysMax ?? null,
      fulfillment: listing.fulfillment,
      sellerId: listing.sellerId,
      sellerName: profile.sellerName || listing.sellerName,
      businessName: profile.businessName,
      businessAddress: profile.businessAddress || (profile.addressAvailable ? '' : 'address_unavailable'),
      matchedProvince: matchedProvince || '',
      productUrl: product.productUrl,
      sellerUrl: profile.sellerUrl,
      scrapedAt: new Date().toISOString(),
    };

    if (shouldExport) {
      stats.provinceMatches++;
      matches++;
      const provinceLabel = matchedProvince || 'no province';
      log.log(
        `    MATCH [${listing.fulfillment}]: ${provinceLabel}${deliveryLabel ? ` | ${deliveryLabel}` : ''} - ${profile.businessAddress?.slice(0, 80)}`
      );
      allResults.push(record);
      onResult(record);
    } else {
      const reason =
        scanOptions.provinceFilter.mode === 'exclude' && matchedProvince
          ? `excluded province (${matchedProvince})`
          : scanOptions.provinceFilter.mode === 'exclude'
            ? 'no province match'
            : 'not in target provinces';
      log.log(
        `    ${listing.fulfillment} seller skipped (${reason}): ${profile.businessAddress?.slice(0, 80) || 'no address'}`
      );
      reportSkip(onSkip, stats, { ...record, skipReason: reason }, 'seller');
    }
  }

  await delay();
  return matches;
}

async function processKeyword(page, keyword, runOptions, stats, allResults, log, signal, onResult, onSkip) {
  const { productLimit, searchFilters, fulfillmentTypes } = runOptions;

  const scannedAsins = new Set();
  const seenSearchAsins = new Set();
  let keywordMatches = 0;
  let pageNum = 0;

  log.log(
    productLimit > 0
      ? `  Mode: auto-pagination (up to ${productLimit} deep scans)`
      : '  Mode: auto-pagination (no limit)'
  );

  while (true) {
    checkAborted(signal);
    pageNum++;

    let products;
    let searchSkipped = [];
    try {
      ({ products, searchSkipped } = await searchSinglePage(page, keyword, pageNum, searchFilters));
    } catch (error) {
      log.error(`  Search failed on page ${pageNum}: ${error.message}`);
      stats.errors.push({ keyword, stage: 'search', page: pageNum, error: error.message });
      break;
    }

    for (const { product: skippedProduct, skipReason } of searchSkipped) {
      trackSearchAsin(stats, skippedProduct.asin, seenSearchAsins);
      reportSkip(onSkip, stats, buildSkipRecord(skippedProduct, keyword, skipReason), 'search');
    }

    for (const product of products) {
      trackSearchAsin(stats, product.asin, seenSearchAsins);
    }

    if (products.length === 0) {
      log.log(`  No results on page ${pageNum}, stopping`);
      break;
    }

    const newProducts = products.filter((p) => !scannedAsins.has(p.asin));
    for (const p of newProducts) scannedAsins.add(p.asin);

    if (newProducts.length === 0) {
      log.log(`  Page ${pageNum} has no new products, stopping`);
      break;
    }

    log.log(`  ${newProducts.length} new product(s) on page ${pageNum}`);

    for (const product of newProducts) {
      if (productLimit > 0 && stats.productsScanned >= productLimit) {
        log.log(`  Deep scan limit (${productLimit}) reached`);
        return keywordMatches;
      }

      checkAborted(signal);
      const matches = await scanProduct(
        page,
        product,
        keyword,
        runOptions,
        stats,
        allResults,
        log,
        onResult,
        onSkip
      );
      keywordMatches += matches;

      if (productLimit > 0 && stats.productsScanned >= productLimit) {
        log.log(`  Deep scan limit (${productLimit}) reached`);
        return keywordMatches;
      }
    }

    log.log(`  Page ${pageNum} done, trying next page...`);
    await delay();
  }

  return keywordMatches;
}

function loadKeywords(options) {
  const keywords = [];

  if (options.keywords?.length) {
    keywords.push(...options.keywords);
  } else if (options.keyword) {
    keywords.push(options.keyword);
  }

  if (options.keywordsFile) {
    const content = fs.readFileSync(options.keywordsFile, 'utf-8');
    const fromFile = content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    keywords.push(...fromFile);
  }

  return [...new Set(keywords)];
}

/**
 * @param {object} options - scrape options (CLI flags or web form)
 * @param {{ onLog?: (msg: string) => void, signal?: AbortSignal, echoToConsole?: boolean }} ctx
 */
export async function runScrape(
  options,
  { onLog = () => {}, onResult = () => {}, onSkip = () => {}, signal, echoToConsole = true } = {}
) {
  const log = createLogger(onLog, { echoToConsole });
  const keywords = loadKeywords(options);

  if (keywords.length === 0) {
    throw new Error('At least one keyword is required');
  }

  const config = getConfig();
  const headed = options.headed || process.env.HEADLESS === 'false';
  const productLimit = Number(options.limit) || 0;
  const searchFilters = {
    minPrice: options.minPrice != null ? Number(options.minPrice) : null,
    maxPrice: options.maxPrice != null ? Number(options.maxPrice) : null,
    minDeliveryDays: options.minDeliveryDays != null ? Number(options.minDeliveryDays) : null,
    maxDeliveryDays: options.maxDeliveryDays != null ? Number(options.maxDeliveryDays) : null,
  };
  const fulfillmentTypes = parseFulfillmentOption(options.fulfillment ?? 'fbm');
  const postcode = options.postcode ?? config.postcode;

  log.log('Amazon UK FBM Scraper');
  log.log(`Keywords: ${keywords.join(', ')}`);
  log.log(`Fulfillment: ${fulfillmentTypes.join(', ')}`);
  if (!options.noPostcode) log.log(`Delivery postcode: ${postcode}`);
  if (productLimit > 0) log.log(`Deep scan limit: ${productLimit}`);
  if (searchFilters.minPrice != null) log.log(`Min price: ${searchFilters.minPrice}`);
  if (searchFilters.maxPrice != null) log.log(`Max price: ${searchFilters.maxPrice}`);
  if (searchFilters.minDeliveryDays != null) log.log(`配送 >= ${searchFilters.minDeliveryDays} 天（按最长）`);
  if (searchFilters.maxDeliveryDays != null) log.log(`配送 <= ${searchFilters.maxDeliveryDays} 天（按最短）`);

  const provinceFilter = buildProvinceFilter(options);
  if (provinceFilter.mode === 'all') {
    log.log('Province filter: export all');
  } else if (provinceFilter.mode === 'exclude') {
    log.log(`Province filter: exclude ${provinceFilter.excludeProvinces.join('、')}`);
  } else {
    log.log('Province filter: 山西 / 陕西 / 河南 / 河北');
  }

  log.log(`Headless: ${!headed}`);
  log.log('---');

  checkAborted(signal);

  log.log('Starting browser and checking proxy...');

  const browserPromise = createBrowser({ headless: !headed });
  const proxyPromise = options.skipProxyCheck
    ? Promise.resolve(null)
    : checkProxyCountry(getConfig().proxyUrl);

  const [proxyCheck, { browser, page }] = await Promise.all([proxyPromise, browserPromise]);

  if (proxyCheck) {
    log.log(`Proxy country: ${proxyCheck.country || 'n/a'} — ${proxyCheck.message}`);
    if (!proxyCheck.ok) {
      log.warn('\n⚠️  UK VPN recommended:', proxyCheck.message);
      log.warn('   Offers may be empty without UK delivery. Switch VPN to UK, or use --skip-proxy-check.\n');
    }
  }

  checkAborted(signal);

  const allResults = [];
  const allSkipped = [];
  const stats = {
    searchResultsSeen: 0,
    searchFiltered: 0,
    preScanSkipped: 0,
    productsScanned: 0,
    productScanSkipped: 0,
    offersFound: 0,
    sellersChecked: 0,
    provinceMatches: 0,
    sellerSkipped: 0,
    skippedCount: 0,
    errors: [],
  };

  let errorLogPath = null;

  try {
    if (!options.noPostcode) {
      try {
        log.log('Setting UK delivery postcode...');
        await setDeliveryPostcode(page, postcode);
      } catch (error) {
        log.warn(`Postcode setup failed: ${error.message}`);
        stats.errors.push({ stage: 'postcode', error: error.message });
      }
    }

    const runOptions = {
      productLimit,
      searchFilters,
      fulfillmentTypes,
      provinceFilter,
      cacheDir: config.cacheDir,
    };

    for (const keyword of keywords) {
      checkAborted(signal);
      log.log(`\n[Keyword] ${keyword}`);
      await processKeyword(page, keyword, runOptions, stats, allResults, log, signal, onResult, (record) => {
        allSkipped.push(record);
        onSkip(record);
      });
      await delay();
    }
  } finally {
    await browser.close();
  }

  const { jsonPath, csvPath } = exportResults(allResults, {
    outputPath: options.output,
    keyword: keywords[0],
  });

  const searchPassed = Math.max(0, stats.searchResultsSeen - stats.searchFiltered);
  const notProcessed = Math.max(0, searchPassed - stats.preScanSkipped - stats.productsScanned);

  log.log('\n=== Summary ===');
  log.log(`Search results seen: ${stats.searchResultsSeen} (unique ASINs)`);
  log.log(`  Search filtered: ${stats.searchFiltered}`);
  log.log(`  Passed search: ${searchPassed}`);
  if (stats.preScanSkipped > 0) {
    log.log(`  Pre-scan skipped (non-Chinese): ${stats.preScanSkipped}`);
  }
  log.log(`  Deep scanned: ${stats.productsScanned}`);
  if (stats.productScanSkipped > 0) {
    log.log(`  Scan skipped (no offers / offer error): ${stats.productScanSkipped}`);
  }
  if (notProcessed > 0) {
    log.log(`  Not processed (limit or pagination end): ${notProcessed}`);
  }
  log.log(`Offers found: ${stats.offersFound}`);
  log.log(`Sellers checked: ${stats.sellersChecked}`);
  log.log(`Province matches: ${stats.provinceMatches}`);
  log.log(`Seller skipped: ${stats.sellerSkipped}`);
  log.log(`Skipped records (total): ${stats.skippedCount}`);
  log.log(`Errors: ${stats.errors.length}`);
  log.log(`Results saved to:`);
  log.log(`  JSON: ${jsonPath}`);
  log.log(`  CSV:  ${csvPath}`);

  if (stats.errors.length > 0) {
    errorLogPath = path.join(getConfig().outputDir, `errors_${Date.now()}.json`);
    fs.mkdirSync(getConfig().outputDir, { recursive: true });
    fs.writeFileSync(errorLogPath, JSON.stringify(stats.errors, null, 2), 'utf-8');
    log.log(`  Errors: ${errorLogPath}`);
  }

  return {
    results: allResults,
    skippedResults: allSkipped,
    stats,
    jsonPath,
    csvPath,
    errorLogPath,
    keywords,
  };
}
