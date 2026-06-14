import fs from 'fs';
import path from 'path';
import { buildSellerUrl, getConfig, gotoWithRetry } from './browser.js';

/**
 * Scrape seller profile page for business name and address.
 */
export async function getSellerProfile(page, sellerId) {
  const config = getConfig();
  const cached = readSellerCache(sellerId, config.cacheDir);
  if (cached) {
    console.log(`    Using cached seller profile: ${sellerId}`);
    return cached;
  }

  const url = buildSellerUrl(sellerId);
  console.log(`    Fetching seller profile: ${url}`);

  await gotoWithRetry(page, url);
  const settleMs = getConfig().pageSettleMs;
  if (settleMs > 0) {
    await page.waitForTimeout(Math.min(settleMs, 600));
  }

  const profile = await page.evaluate((id) => {
    const result = {
      sellerId: id,
      sellerName: '',
      businessName: '',
      businessAddress: '',
      sellerUrl: `https://www.amazon.co.uk/sp?seller=${id}`,
      addressAvailable: false,
    };

    // Seller name
    result.sellerName =
      document.querySelector('#seller-name')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      '';

    // Business information section (UK transparency requirements)
    const detailRows = document.querySelectorAll(
      '#page-section-detail-seller-info .a-row, .a-box-inner .a-row, #seller-info-storefront-link ~ div .a-row'
    );

    let businessInfoText = '';

    for (const row of detailRows) {
      const label = row.querySelector('.a-span3, .a-color-secondary')?.textContent?.trim() || '';
      const value = row.querySelector('.a-span9, .indent-left')?.textContent?.trim() || row.textContent?.trim() || '';

      if (/business name/i.test(label)) {
        result.businessName = value.replace(/^Business Name\s*/i, '').trim();
      }
      if (/business address/i.test(label)) {
        result.businessAddress = value.replace(/^Business Address\s*/i, '').trim();
        result.addressAvailable = Boolean(result.businessAddress);
      }

      businessInfoText += `${label} ${value}\n`;
    }

    // Fallback: scan page text for business address patterns
    if (!result.businessAddress) {
      const pageText = document.body.innerText;
      const addressMatch = pageText.match(
        /Business Address[:\s]*([\s\S]{5,200}?)(?=Business Name|Phone|Customer Service|About|$)/i
      );
      if (addressMatch) {
        result.businessAddress = addressMatch[1].trim().replace(/\s+/g, ' ');
        result.addressAvailable = true;
      }

      const nameMatch = pageText.match(/Business Name[:\s]*(.+?)(?=Business Address|Phone|$)/i);
      if (nameMatch && !result.businessName) {
        result.businessName = nameMatch[1].trim();
      }
    }

    // Additional fallback for detailed information block
    if (!result.businessAddress) {
      const detailBlock = document.querySelector('#page-section-detail-seller-info, .a-section.a-spacing-none.a-padding-medium');
      if (detailBlock) {
        const blockText = detailBlock.innerText;
        const lines = blockText.split('\n').map((l) => l.trim()).filter(Boolean);
        const addrIdx = lines.findIndex((l) => /business address/i.test(l));
        if (addrIdx >= 0 && lines[addrIdx + 1]) {
          result.businessAddress = lines.slice(addrIdx + 1, addrIdx + 4).join(', ');
          result.addressAvailable = true;
        }
        const nameIdx = lines.findIndex((l) => /business name/i.test(l));
        if (nameIdx >= 0 && lines[nameIdx + 1] && !result.businessName) {
          result.businessName = lines[nameIdx + 1];
        }
      }
    }

    if (!result.businessName && businessInfoText) {
      const nameFromText = businessInfoText.match(/Business Name\s+(.+)/i);
      if (nameFromText) result.businessName = nameFromText[1].trim();
    }

    return result;
  }, sellerId);

  writeSellerCache(sellerId, profile, config.cacheDir);
  return profile;
}

function getCachePath(sellerId, cacheDir) {
  return path.join(cacheDir, `${sellerId}.json`);
}

function readSellerCache(sellerId, cacheDir) {
  try {
    const filePath = getCachePath(sellerId, cacheDir);
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data;
  } catch {
    return null;
  }
}

function writeSellerCache(sellerId, profile, cacheDir) {
  try {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    const filePath = getCachePath(sellerId, cacheDir);
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8');
  } catch (error) {
    console.warn(`    Failed to write cache for ${sellerId}:`, error.message);
  }
}

export { readSellerCache, writeSellerCache };
