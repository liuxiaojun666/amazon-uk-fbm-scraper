import {
  parseDeliveryDays,
  filterProductsByDelivery,
  enrichProductDelivery,
  formatDeliveryDays,
  formatDeliverySummary,
} from '../src/filters/delivery.js';

const ref = new Date('2026-06-14T12:00:00Z');
let passed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`OK: ${label}`);
    passed++;
  } else {
    console.log(`FAIL: ${label}`);
  }
}

const rangeSameMonth = parseDeliveryDays('FREE delivery 13 - 22 Jul', ref);
assert(
  'same-month range',
  rangeSameMonth.deliveryDaysMin === 29 && rangeSameMonth.deliveryDaysMax === 38
);

const crossMonth = parseDeliveryDays('£9.99 delivery 29 Jun - 3 Jul', ref);
assert(
  'cross-month range',
  crossMonth.deliveryDaysMin === 15 && crossMonth.deliveryDaysMax === 19
);

const tomorrow = parseDeliveryDays('Or fastest delivery Tomorrow, 15 Jun', ref);
assert('tomorrow', tomorrow.deliveryDaysMin === 1 && tomorrow.deliveryDaysMax === 1);

const single = parseDeliveryDays('FREE delivery Wed, 18 Jun', ref);
assert('single date', single.deliveryDaysMin === 4 && single.deliveryDaysMax === 4);

const products = [
  enrichProductDelivery({ asin: 'A', deliveryText: 'FREE delivery 20 - 30 Jun' }, ref),
  enrichProductDelivery({ asin: 'B', deliveryText: 'FREE delivery Wed, 18 Jun' }, ref),
  enrichProductDelivery({ asin: 'C', deliveryText: 'FREE delivery 13 - 22 Jul' }, ref),
];

const filtered = filterProductsByDelivery(products, { minDeliveryDays: 15, maxDeliveryDays: 20 });
assert('filter max>=15 and min<=20 keeps in-range item only', filtered.length === 1 && filtered[0].asin === 'A');

const slowOnly = filterProductsByDelivery(products, { minDeliveryDays: 20 });
assert('filter max>=20 keeps slow item', slowOnly.length === 1 && slowOnly[0].asin === 'C');

assert(
  'format delivery days',
  formatDeliveryDays({ deliveryDaysMin: 5, deliveryDaysMax: 8 }) === '5-8天'
);
assert(
  'format delivery summary',
  formatDeliverySummary({
    deliveryDaysMin: 5,
    deliveryDaysMax: 8,
    deliveryText: 'FREE delivery 20 - 30 Jun',
  }) === '5-8天 · FREE delivery 20 - 30 Jun'
);

assert(
  'map must not pass index as reference date',
  (() => {
    const items = [{ deliveryText: 'FREE delivery 7 - 13 Jul' }].map((p) => enrichProductDelivery(p));
    return items[0].deliveryDaysMin === 23 && items[0].deliveryDaysMax === 29;
  })()
);

assert(
  'explicit day range',
  parseDeliveryDays('FREE delivery 24 - 30 days').deliveryDaysMin === 24 &&
    parseDeliveryDays('FREE delivery 24 - 30 days').deliveryDaysMax === 30
);

const giftCardNoise =
  "FREE delivery 7 - 13 July. Details Arrives after Father's Day. Need a gift sooner? Send an Amazon Gift Card today by email or text message.";
const giftCardParsed = parseDeliveryDays(giftCardNoise, ref);
assert(
  'ignore gift-card today marketing',
  giftCardParsed.deliveryDaysMin === 23 && giftCardParsed.deliveryDaysMax === 29
);

assert(
  'full month name July',
  parseDeliveryDays('FREE delivery 13 - 22 July', ref).deliveryDaysMin === 29 &&
    parseDeliveryDays('FREE delivery 13 - 22 July', ref).deliveryDaysMax === 38
);

console.log(`\n${passed}/12 passed`);
process.exit(passed === 12 ? 0 : 1);
