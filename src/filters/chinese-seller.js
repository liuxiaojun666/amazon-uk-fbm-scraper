import { CHINA_PROVINCES } from '../../config/provinces.js';
import { matchProvince } from './province.js';

const CJK_RE = /[\u3400-\u9fff\uF900-\uFAFF]/;
const PINYIN_COMPANY_RE =
  /(gongsi|shangmao|youxiangongsi|maoyi|dianzi|keji|shangwu|shangxing|jingyingbu)/i;
const WESTERN_ENTITY_RE = /\b(LLC|L\.?L\.?C\.?|Inc\.?|Ltd\.?|Limited|PLC|GmbH|LLP)\b/i;
const UK_POSTCODE_RE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i;

const CHINESE_BUSINESS_TERMS = [
  '有限公司',
  '商贸',
  '经营部',
  '个体工商户',
  '电子商务',
  '商行',
  '贸易',
  '科技',
];

const PINYIN_PLACE_KEYWORDS = CHINA_PROVINCES.flatMap((province) => province.keywords.slice(2))
  .filter((keyword) => /^[a-z]{3,}$/i.test(keyword))
  .map((keyword) => keyword.toLowerCase());

export function extractSellerNameFromSearchCard(cardText = '') {
  if (!cardText) return '';

  const patterns = [
    /dispatches from and sold by\s+(.+?)(?:\s+FREE|\s+£|\s+Delivery|\s+Fulfilled|\s+Add|\s+\d|$)/i,
    /ships from and sold by\s+(.+?)(?:\s+FREE|\s+£|\s+Delivery|\s+Fulfilled|\s+Add|\s+\d|$)/i,
    /shipper\s*\/\s*seller\s+(.+?)(?:\s+FREE|\s+£|\s+Delivery|\s+Fulfilled|\s+Add|\s+\d|$)/i,
    /sold by\s+(.+?)(?:\s+Seller\s+rating|\s+FREE|\s+£|\s+Delivery|\s+Fulfilled|\s+Add|\s+\d|$)/i,
  ];

  for (const pattern of patterns) {
    const match = cardText.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim();
      if (name && !/^(amazon|details|seller profile)$/i.test(name)) {
        return name;
      }
    }
  }

  return '';
}

export function hasChineseIndicators(text = '') {
  if (!text) return false;
  if (CJK_RE.test(text)) return true;
  if (PINYIN_COMPANY_RE.test(text)) return true;
  if (CHINESE_BUSINESS_TERMS.some((term) => text.includes(term))) return true;

  const lower = text.toLowerCase();
  if (PINYIN_PLACE_KEYWORDS.some((keyword) => lower.includes(keyword))) return true;

  if (/[a-z]{12,}/i.test(text) && !/\s/.test(text.trim())) return true;

  return false;
}

export function isChineseAddress(address = '') {
  if (!address) return false;
  if (CJK_RE.test(address)) return true;
  if (/\b(?:china|cn)\b/i.test(address)) return true;
  if (matchProvince(address)) return true;
  if (PINYIN_COMPANY_RE.test(address)) return true;
  return false;
}

export function isWesternAddress(address = '') {
  if (!address) return false;
  if (isChineseAddress(address)) return false;
  if (UK_POSTCODE_RE.test(address)) return true;
  if (/\b(?:united kingdom|england|scotland|wales|northern ireland)\b/i.test(address)) return true;
  if (/\b[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*,\s*[A-Z]{2}\b/.test(address)) return true;
  if (/\bUnit\s+\d\b/i.test(address) && !hasChineseIndicators(address)) return true;
  if (/\b(?:ltd|limited|plc|llp)\b/i.test(address) && !hasChineseIndicators(address)) return true;
  if (/\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|circle|cir\.?|way)\b/i.test(address) && !hasChineseIndicators(address)) {
    return true;
  }
  if (/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(address)) return true;
  return false;
}

export function isConfidentlyNonChineseSellerName(sellerName = '') {
  const name = sellerName.trim();
  if (!name) return false;
  if (/^amazon\b/i.test(name)) return true;
  if (hasChineseIndicators(name)) return false;

  if (WESTERN_ENTITY_RE.test(name)) return true;

  if (/\b(?:uk|britain|europe|devon|london|edinburgh|manchester)\b/i.test(name) && /\s/.test(name)) {
    return true;
  }

  const words = name.split(/[\s,/&+-]+/).filter(Boolean);
  if (words.length >= 2 && words.every((word) => /^[A-Z][a-z'.]{1,}$/.test(word) || /^[A-Z]{2,}$/.test(word))) {
    return true;
  }

  return false;
}

/**
 * @returns {'chinese' | 'non_chinese' | 'unknown'}
 */
export function classifySellerOrigin({ sellerName = '', businessAddress = '', cardText = '' } = {}) {
  const combined = [sellerName, businessAddress, cardText].filter(Boolean).join(' ');

  if (hasChineseIndicators(combined)) return 'chinese';
  if (businessAddress && isChineseAddress(businessAddress)) return 'chinese';
  if (businessAddress && isWesternAddress(businessAddress)) return 'non_chinese';
  if (sellerName && isConfidentlyNonChineseSellerName(sellerName)) return 'non_chinese';

  return 'unknown';
}

export function shouldSkipDeepScan({ sellerId, sellerName = '', businessAddress = '', cardText = '' } = {}) {
  return classifySellerOrigin({ sellerName, businessAddress, cardText }) === 'non_chinese';
}
