const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysFromToday(targetDate, referenceDate = new Date()) {
  const today = startOfDay(referenceDate);
  const target = startOfDay(targetDate);
  return Math.round((target - today) / 86400000);
}

function parseMonthToken(token) {
  if (!token) return null;
  const key = token.toLowerCase().slice(0, 3);
  return MONTHS[key] ?? null;
}

/** Strip Amazon gift-card / marketing tails from product-page delivery blocks. */
export function normalizeDeliveryText(deliveryText) {
  if (!deliveryText || typeof deliveryText !== 'string') return '';

  let text = deliveryText.replace(/\s+/g, ' ').trim();
  text = text.split(/\.\s+(?:Details|Arrives after|Need a gift)/i)[0].trim();

  const deliveryLine =
    text.match(/(?:FREE|[£$€]\s*[\d,.]+)\s+delivery[^.]+/i)?.[0] ||
    text.match(/\b(?:get it|arrives)\b[^.]+/i)?.[0] ||
    text;

  return deliveryLine.trim();
}

function isDeliveryToday(text) {
  return (
    /\b(?:get it|arrives|(?:free )?delivery)\s+today\b/i.test(text) ||
    /^today\b/i.test(text)
  );
}

function isDeliveryTomorrow(text) {
  return (
    /\b(?:get it|arrives|(?:free )?delivery)\s+tomorrow\b/i.test(text) ||
    /^tomorrow\b/i.test(text)
  );
}

function buildDate(day, monthToken, referenceDate = new Date()) {
  const month = parseMonthToken(monthToken);
  if (month == null || !Number.isFinite(day)) return null;

  const ref = startOfDay(referenceDate);
  let year = ref.getFullYear();
  let candidate = new Date(year, month, day);

  // Amazon omits the year; roll forward when the date already passed this year.
  if (candidate < ref) {
    candidate = new Date(year + 1, month, day);
  }

  return candidate;
}

/**
 * Parse Amazon UK delivery text into min/max days from today.
 * Examples:
 *   "FREE delivery 13 - 22 Jul"
 *   "£9.99 delivery 29 Jun - 3 Jul"
 *   "FREE delivery Wed, 18 Jun"
 *   "Or fastest delivery Tomorrow, 15 Jun"
 */
export function parseDeliveryDays(deliveryText, referenceDate = new Date()) {
  const text = normalizeDeliveryText(deliveryText);
  if (!text) {
    return { deliveryDaysMin: null, deliveryDaysMax: null };
  }

  const dayRange = text.match(/\b(\d{1,3})\s*-\s*(\d{1,3})\s+days?\b/i);
  if (dayRange) {
    return {
      deliveryDaysMin: Number(dayRange[1]),
      deliveryDaysMax: Number(dayRange[2]),
    };
  }

  const explicitDays = text.match(/\b(\d{1,3})\s+days?\b/i);
  if (explicitDays) {
    const days = Number(explicitDays[1]);
    return { deliveryDaysMin: days, deliveryDaysMax: days };
  }

  const crossMonth =
    text.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s*-\s*(\d{1,2})\s+([A-Za-z]{3,9})/) ||
    text.match(/(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]{3,9})/);

  if (crossMonth) {
    if (crossMonth[4] != null) {
      const start = buildDate(Number(crossMonth[1]), crossMonth[2], referenceDate);
      const end = buildDate(Number(crossMonth[3]), crossMonth[4], referenceDate);
      if (start && end) {
        return {
          deliveryDaysMin: daysFromToday(start, referenceDate),
          deliveryDaysMax: daysFromToday(end, referenceDate),
        };
      }
    }

    const startDay = Number(crossMonth[1]);
    const endDay = Number(crossMonth[2]);
    const monthToken = crossMonth[3];
    const start = buildDate(startDay, monthToken, referenceDate);
    const end = buildDate(endDay, monthToken, referenceDate);
    if (start && end) {
      return {
        deliveryDaysMin: daysFromToday(start, referenceDate),
        deliveryDaysMax: daysFromToday(end, referenceDate),
      };
    }
  }

  const singleDate =
    text.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s*(\d{1,2})\s+([A-Za-z]{3,9})/i) ||
    text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\b/);

  if (singleDate) {
    const date = buildDate(Number(singleDate[1]), singleDate[2], referenceDate);
    if (date) {
      const days = daysFromToday(date, referenceDate);
      return { deliveryDaysMin: days, deliveryDaysMax: days };
    }
  }

  if (isDeliveryToday(text)) {
    return { deliveryDaysMin: 0, deliveryDaysMax: 0 };
  }

  if (isDeliveryTomorrow(text)) {
    return { deliveryDaysMin: 1, deliveryDaysMax: 1 };
  }

  return { deliveryDaysMin: null, deliveryDaysMax: null };
}

export function enrichProductDelivery(product, referenceDate = new Date()) {
  const deliveryText = normalizeDeliveryText(product.deliveryText) || product.deliveryText || '';
  const { deliveryDaysMin, deliveryDaysMax } = parseDeliveryDays(deliveryText, referenceDate);
  return {
    ...product,
    deliveryText,
    deliveryDaysMin,
    deliveryDaysMax,
  };
}

/** >= threshold: match when product's max delivery days meets or exceeds the value. */
export function matchesMinDeliveryDays(product, minDeliveryDays) {
  if (minDeliveryDays == null) return true;
  const max = product.deliveryDaysMax;
  if (max == null) return true;
  return max >= minDeliveryDays;
}

/** <= threshold: match when product's min delivery days is at or below the value. */
export function matchesMaxDeliveryDays(product, maxDeliveryDays) {
  if (maxDeliveryDays == null) return true;
  const min = product.deliveryDaysMin;
  if (min == null) return true;
  return min <= maxDeliveryDays;
}

export function filterProductsByDelivery(products, { minDeliveryDays, maxDeliveryDays } = {}) {
  return products.filter(
    (product) =>
      matchesMinDeliveryDays(product, minDeliveryDays) &&
      matchesMaxDeliveryDays(product, maxDeliveryDays)
  );
}

export function describeDeliveryFilters({ minDeliveryDays, maxDeliveryDays } = {}) {
  const parts = [];
  if (minDeliveryDays != null) parts.push(`max >= ${minDeliveryDays}d`);
  if (maxDeliveryDays != null) parts.push(`min <= ${maxDeliveryDays}d`);
  return parts.join(', ');
}

export function formatDeliveryDays({ deliveryDaysMin, deliveryDaysMax } = {}) {
  if (deliveryDaysMin == null || deliveryDaysMax == null) return '';
  if (deliveryDaysMin === deliveryDaysMax) return `${deliveryDaysMin}天`;
  return `${deliveryDaysMin}-${deliveryDaysMax}天`;
}

export function formatDeliverySummary(product = {}) {
  const days = formatDeliveryDays(product);
  if (days && product.deliveryText) return `${days} · ${product.deliveryText}`;
  return days || product.deliveryText || '';
}
