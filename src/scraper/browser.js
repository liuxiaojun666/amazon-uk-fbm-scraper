import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { isProxyDisabled } from '../../scripts/proxy-env.js';

dotenv.config();

const AMAZON_UK_BASE = 'https://www.amazon.co.uk';

function getProxyUrl() {
  if (isProxyDisabled()) return '';
  return (
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    ''
  );
}

export function getConfig() {
  return {
    delayMs: Number(process.env.DELAY_MS) || 4000,
    /** Short wait after DOM ready (replaces fixed 2s sleeps in gotoWithRetry) */
    pageSettleMs: Number(process.env.PAGE_SETTLE_MS) || 800,
    headless: process.env.HEADLESS !== 'false',
    outputDir: process.env.OUTPUT_DIR || 'data',
    cacheDir: process.env.CACHE_DIR || 'cache',
    maxRetries: Number(process.env.MAX_RETRIES) || 2,
    baseUrl: AMAZON_UK_BASE,
    proxyUrl: getProxyUrl(),
    postcode: process.env.DELIVERY_POSTCODE || 'SW1A 1AA',
  };
}

export async function createBrowser({ headless } = {}) {
  const config = getConfig();
  const launchOptions = {
    headless: headless ?? config.headless,
    args: ['--disable-blink-features=AutomationControlled'],
  };

  if (config.proxyUrl) {
    launchOptions.proxy = { server: config.proxyUrl };
    console.log(`Using proxy: ${config.proxyUrl}`);
  } else {
    console.log('Direct connection (no HTTP proxy — uses system VPN like Chrome)');
  }

  const browser = await chromium.launch(launchOptions);

  const context = await browser.newContext({
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
    extraHTTPHeaders: {
      'Accept-Language': 'en-GB,en;q=0.9',
    },
  });

  const page = await context.newPage();

  return { browser, context, page };
}

export async function delay(ms) {
  const config = getConfig();
  await new Promise((resolve) => setTimeout(resolve, ms ?? config.delayMs));
}

export async function gotoWithRetry(page, url, { maxRetries, settleMs } = {}) {
  const config = getConfig();
  const retries = maxRetries ?? config.maxRetries;
  const waitMs = settleMs ?? config.pageSettleMs;
  let lastError;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      await dismissCookieBanner(page);
      if (waitMs > 0) {
        await page.waitForTimeout(waitMs);
      }

      if (await isBlockedPage(page, response)) {
        throw new Error(
          'Amazon returned blocked/503 page. Ensure VPN proxy uses a UK exit node.'
        );
      }

      if (await isCaptchaPage(page)) {
        throw new Error(
          'CAPTCHA detected. Re-run with --headed to solve it manually, then retry.'
        );
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt <= retries) {
        console.warn(`  Retry ${attempt}/${retries} for ${url}`);
        await delay(config.delayMs);
      }
    }
  }

  throw lastError;
}

async function dismissCookieBanner(page) {
  const selectors = [
    '#sp-cc-accept',
    'input#sp-cc-accept',
    '#sp-cc-rejectall-link',
    'button[data-action="accept"]',
    '#acceptCookies',
  ];

  for (const selector of selectors) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(400);
      return;
    }
  }
}

async function isBlockedPage(page, response) {
  const status = response?.status();
  if (status && status >= 500) return true;

  const title = await page.title().catch(() => '');
  const bodyLen = await page.evaluate(() => document.body?.innerText?.trim().length || 0);

  return (
    bodyLen < 50 ||
    /sorry|something went wrong|service unavailable/i.test(title) ||
    (await page.locator('img[alt*="Dogs of Amazon"]').count()) > 0
  );
}

async function isCaptchaPage(page) {
  const title = await page.title().catch(() => '');
  const url = page.url();
  return (
    /captcha|robot/i.test(title) ||
    /captcha|validateCaptcha/i.test(url) ||
    (await page.locator('form[action*="validateCaptcha"]').count()) > 0
  );
}

export function buildSearchUrl(keyword, page = 1, { minPrice, maxPrice, sort } = {}) {
  const params = new URLSearchParams({ k: keyword });
  if (page > 1) {
    params.set('page', String(page));
  }
  if (sort) {
    params.set('s', sort);
  }
  // Amazon UK price filters use whole pounds (not pence)
  if (minPrice != null && minPrice > 0) {
    params.set('low-price', String(Math.round(minPrice)));
  }
  if (maxPrice != null && maxPrice > 0) {
    params.set('high-price', String(Math.round(maxPrice)));
  }
  return `${AMAZON_UK_BASE}/s?${params.toString()}`;
}

export function buildProductUrl(asin) {
  return `${AMAZON_UK_BASE}/dp/${asin}`;
}

export function buildOfferListingUrl(asin) {
  return `${AMAZON_UK_BASE}/gp/offer-listing/${asin}`;
}

export function buildSellerUrl(sellerId) {
  return `${AMAZON_UK_BASE}/sp?seller=${sellerId}`;
}
