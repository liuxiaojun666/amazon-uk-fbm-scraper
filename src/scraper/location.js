import { gotoWithRetry, getConfig } from './browser.js';

/** Default central London postcode (Westminster) */
export const DEFAULT_LONDON_POSTCODE = 'SW1A 1AA';

const ADDRESS_SELECTIONS_URL =
  '/gp/glow/get-address-selections.html?deviceType=desktop&pageType=Gateway&storeContext=NoStoreName&actionSource=desktop-modal';
const ADDRESS_CHANGE_URL = '/gp/delivery/ajax/address-change.html';
const PORTAL_ADDRESS_CHANGE = '/portal-migration/hz/glow/address-change?actionSource=glow';
const LOCATION_LABEL_URL =
  '/portal-migration/hz/glow/get-location-label?storeContext=generic&pageType=Gateway&actionSource=desktop-modal';
const COOKIE_ACCEPT_URL = '/privacyprefs/retail/v1/acceptall';

/**
 * Format UK postcode for Amazon input.
 * Accepts "SW1A1AA", "sw1a 1aa", or alias "london".
 */
export function formatUkPostcode(raw) {
  if (!raw || typeof raw !== 'string') return DEFAULT_LONDON_POSTCODE;

  const trimmed = raw.trim();
  if (/^london$/i.test(trimmed)) return DEFAULT_LONDON_POSTCODE;

  const cleaned = trimmed.replace(/\s+/g, '').toUpperCase();
  if (cleaned.length >= 5) {
    return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
  }
  return cleaned;
}

function postcodeMatches(label, formatted) {
  const norm = (s) => s.replace(/\s/g, '').toUpperCase();
  const target = norm(formatted);
  const current = norm(label);
  if (!target || !current) return false;
  // SW1A 1 matches SW1A 1AA prefix
  return current.includes(target) || target.startsWith(current.slice(0, 4));
}

async function readDeliveryLabel(page) {
  const opts = { timeout: 1500 };
  const line1 = await page.locator('#glow-ingress-line1').first().textContent(opts).catch(() => '');
  const line2 = await page.locator('#glow-ingress-line2').first().textContent(opts).catch(() => '');
  return [line1, line2].join(' ').replace(/\s+/g, ' ').trim();
}

function isOnAmazonUk(page) {
  try {
    return new URL(page.url()).hostname.endsWith('amazon.co.uk');
  } catch {
    return false;
  }
}

function extractCsrfToken(html) {
  if (!html || typeof html !== 'string') return '';
  const meta = html.match(/anti-csrftoken-a2z['"]\s*content=['"]([^'"]+)/i);
  if (meta) return meta[1];
  const input = html.match(/name=['"]anti-csrftoken-a2z['"]\s+value=['"]([^'"]+)/i);
  if (input) return input[1];
  const json = html.match(/"anti-csrftoken-a2z"\s*:\s*"([^"]+)"/i);
  return json?.[1] || '';
}

async function getPageCsrfToken(page) {
  return page.evaluate(() => {
    const input = document.querySelector("input[name='anti-csrftoken-a2z']");
    if (input?.value) return input.value;
    const meta = document.querySelector('meta[name="anti-csrftoken-a2z"]');
    return meta?.getAttribute('content') || '';
  });
}

export async function acceptCookiesOnPage(page) {
  const selectors = [
    '#sp-cc-accept',
    'input#sp-cc-accept',
    '#sp-cc-rejectall-link',
    'button[data-action="accept"]',
  ];

  for (const selector of selectors) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(800);
      return true;
    }
  }

  const csrf = await getPageCsrfToken(page);
  if (!csrf) return false;

  try {
    await page.evaluate(
      async ({ url, token }) => {
        await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'anti-csrftoken-a2z': token,
          },
          body: '{}',
        });
      },
      { url: COOKIE_ACCEPT_URL, token: csrf }
    );
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

/**
 * Set UK delivery via Amazon glow AJAX (country + postcode).
 * @param {{ skipHomeGoto?: boolean }} options - skip homepage load when already on amazon.co.uk
 */
export async function setUkAddressViaApi(page, postcode, { skipHomeGoto = false } = {}) {
  const config = getConfig();
  const formatted = formatUkPostcode(postcode);
  const zipCode = formatted.replace(/\s/g, '').toUpperCase();
  const base = config.baseUrl;

  if (!skipHomeGoto) {
    await gotoWithRetry(page, base);
    await page.waitForTimeout(500);
  }
  await acceptCookiesOnPage(page);

  let result;
  try {
    const csrf = await getPageCsrfToken(page);
    result = await page.evaluate(
      async ({ base, zipCode, csrf }) => {
        const headers = (extra = {}) => ({
          'Content-Type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          ...(csrf ? { 'anti-csrftoken-a2z': csrf } : {}),
          ...extra,
        });

        const postJson = async (path, payload) => {
          const res = await fetch(`${base}${path}`, {
            method: 'POST',
            credentials: 'include',
            headers: headers(),
            body: JSON.stringify(payload),
          });
          const text = await res.text();
          return { ok: res.ok, status: res.status, text: text.slice(0, 300) };
        };

        const postForm = async (path, fields) => {
          const body = new URLSearchParams(fields);
          const res = await fetch(`${base}${path}`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'x-requested-with': 'XMLHttpRequest',
              ...(csrf ? { 'anti-csrftoken-a2z': csrf } : {}),
            },
            body: body.toString(),
          });
          const text = await res.text();
          return { ok: res.ok, status: res.status, text: text.slice(0, 300) };
        };

        const country = await postJson('/portal-migration/hz/glow/address-change?actionSource=glow', {
          locationType: 'COUNTRY',
          district: 'GB',
          countryCode: 'GB',
          storeContext: 'generic',
          deviceType: 'web',
          pageType: 'Gateway',
          actionSource: 'glow',
        });

        const zip = await postForm('/gp/delivery/ajax/address-change.html', {
          locationType: 'LOCATION_INPUT',
          zipCode,
          storeContext: 'generic',
          deviceType: 'web',
          pageType: 'Gateway',
          actionSource: 'glow',
          almBrandId: 'undefined',
        });

        let label = '';
        try {
          const labelRes = await fetch(
            `${base}/portal-migration/hz/glow/get-location-label?storeContext=generic&pageType=Gateway&actionSource=desktop-modal`,
            { credentials: 'include' }
          );
          const labelJson = await labelRes.json();
          label = labelJson.deliveryShortLine || labelJson.customerIntentLine || '';
        } catch {
          /* ignore */
        }

        const valid =
          /london|england|united kingdom|SW1A/i.test(label) ||
          /isValidAddress\s*:\s*1|GLUXZipUpdateSuccess/i.test(zip.text);

        return { ok: valid, country, zip, label, hasCsrf: Boolean(csrf) };
      },
      { base, zipCode, csrf }
    );
  } catch (error) {
    result = { ok: false, error: error.message };
  }

  if (result.ok) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
  }

  const label = (await readDeliveryLabel(page)) || result.label || '';
  return { ok: result.ok, label, zipCode, detail: result };
}

/**
 * Open "Deliver to" → "Choose your location" popover (top-left nav).
 */
async function openLocationPopover(page) {
  const trigger = page.locator('#nav-global-location-popover-link').first();
  await trigger.waitFor({ state: 'visible', timeout: 8000 });
  await trigger.click();
  await page.waitForTimeout(800);

  const modal = page.locator(
    '#a-popover-content, #GLUXPopover, [aria-label="Choose your location"]'
  ).first();
  await modal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  return true;
}

/**
 * Switch country to UK inside the location modal only (never footer links).
 */
async function selectUkInModal(page) {
  const selected = await page.evaluate(() => {
    const pop = document.querySelector('#a-popover-content');
    if (!pop) return false;

    const gb = pop.querySelector('a[data-value="GB"]');
    if (gb) {
      gb.click();
      return true;
    }

    const candidates = [...pop.querySelectorAll('a, span.a-button-text, li span')];
    const uk = candidates.find((el) => /^united kingdom$/i.test(el.textContent?.trim() || ''));
    if (uk) {
      uk.click();
      return true;
    }

    const changeLink = [...pop.querySelectorAll('a')].find((a) =>
      /change|country|region/i.test(a.textContent || '')
    );
    if (changeLink) {
      changeLink.click();
      return 'opened';
    }
    return false;
  });

  if (selected === 'opened') {
    await page.waitForTimeout(800);
    return page.evaluate(() => {
      const pop = document.querySelector('#a-popover-content');
      const gb = pop?.querySelector('a[data-value="GB"]');
      if (gb) {
        gb.click();
        return true;
      }
      return false;
    });
  }

  if (selected) await page.waitForTimeout(1500);
  return Boolean(selected);
}

export function isUkDelivery(label) {
  const text = label || '';
  if (/russian|hong kong|china|federation|korea|japan/i.test(text)) return false;
  return /london|england|united kingdom|\b[A-Z]{1,2}\d/i.test(text);
}

/**
 * Fill "or enter a UK mainland postcode" and click Apply.
 */
async function submitPostcodeInModal(page, formatted) {
  const input = page.locator('#a-popover-content #GLUXZipUpdateInput, #GLUXZipUpdateInput').first();
  await input.waitFor({ state: 'visible', timeout: 8000 });

  const value = formatted.replace(/\s/g, '').toUpperCase();
  await input.fill('');
  await input.fill(value);
  await page.waitForTimeout(300);

  // Apply button (screenshot: next to postcode field)
  const applied = await page.evaluate(() => {
    const apply =
      document.querySelector('#GLUXZipUpdate input.a-button-input') ||
      document.querySelector('input[aria-labelledby="GLUXZipUpdate-announce"]');
    if (apply) {
      apply.click();
      return true;
    }
    const span = document.querySelector('#GLUXZipUpdate-announce');
    if (span) {
      span.click();
      return true;
    }
    return false;
  });

  if (!applied) {
    await input.press('Enter');
  }

  await page.waitForTimeout(1500);
  return true;
}

async function closeLocationModal(page) {
  const done = page.locator(
    '#GLUXConfirmClose, input[aria-labelledby="GLUXConfirmClose-announce"], button[name="glowDoneButton"]'
  ).first();

  if (await done.isVisible({ timeout: 3000 }).catch(() => false)) {
    await done.click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
  }
}

/**
 * Set Amazon UK delivery postcode via Deliver to → Choose your location → Apply.
 */
export async function setDeliveryPostcode(page, postcode) {
  const formatted = formatUkPostcode(postcode);
  const config = getConfig();

  console.log(`Setting delivery postcode: ${formatted}`);

  if (!isOnAmazonUk(page)) {
    await gotoWithRetry(page, config.baseUrl);
    await page.waitForTimeout(500);
  }

  let label = await readDeliveryLabel(page).catch(() => '');

  if (postcodeMatches(label, formatted) && isUkDelivery(label)) {
    console.log(`  Delivery location already set: ${label}`);
    return formatted;
  }

  console.log(`  Current delivery: ${label || 'unknown'}`);

  // API first — skip second homepage load when we just opened amazon.co.uk above
  const apiResult = await setUkAddressViaApi(page, formatted, { skipHomeGoto: true });
  label = apiResult.label || (await readDeliveryLabel(page));

  if (isUkDelivery(label)) {
    console.log(`  Delivery location (API): ${label}`);
    return formatted;
  }

  if (apiResult.ok) {
    console.log(`  API accepted postcode ${apiResult.zipCode}, label: ${label || 'unknown'}`);
  } else {
    console.log('  API postcode change did not confirm UK — trying UI modal...');
  }

  await openLocationPopover(page);

  // Non-UK VPN may show country picker first — only interact inside modal
  const hasPostcodeInput = await page
    .locator('#GLUXZipUpdateInput')
    .isVisible({ timeout: 2000 })
    .catch(() => false);

  if (!hasPostcodeInput) {
    console.log('  UK postcode field not visible, selecting United Kingdom in modal...');
    await selectUkInModal(page);
    await page.waitForTimeout(1000);
  }

  const hasInputNow = await page
    .locator('#GLUXZipUpdateInput')
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  if (!hasInputNow) {
    console.warn('  Cannot set UK postcode in headless mode — use UK VPN or --headed');
    await page.keyboard.press('Escape').catch(() => {});
    return formatted;
  }

  await submitPostcodeInModal(page, formatted);
  await closeLocationModal(page);

  label = await readDeliveryLabel(page);
  if (label) {
    console.log(`  Delivery location: ${label}`);
  }

  if (!isUkDelivery(label)) {
    console.warn('  ⚠️  Postcode not applied — still non-UK. Use UK VPN + --headed if needed.');
  }

  return formatted;
}
