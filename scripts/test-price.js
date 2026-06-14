import { parsePrice, matchesMinPrice, matchesMaxPrice, matchesMinDiscount, filterProductsByPrice } from '../src/filters/price.js';

const priceTests = [
  [parsePrice('£19.99'), 19.99],
  [parsePrice('HKD 96.24'), 96.24],
  [parsePrice(''), null],
];

let passed = 0;
for (const [result, expected] of priceTests) {
  const ok = result === expected;
  console.log(`${ok ? 'OK' : 'FAIL'}: parsePrice => ${result} (expected ${expected})`);
  if (ok) passed++;
}

const filtered = filterProductsByPrice(
  [
    { asin: 'A', price: '£30.00', priceValue: 30 },
    { asin: 'B', price: '£60.00', priceValue: 60, discountPercent: 55 },
    { asin: 'C', price: '£80.00', priceValue: 80, discountPercent: 20 },
  ],
  { minPrice: 50, minDiscount: 50 }
);

const filterOk = filtered.length === 1 && filtered[0].asin === 'B';
console.log(`${filterOk ? 'OK' : 'FAIL'}: combined price+discount filter`);
if (filterOk) passed++;

const rangeFiltered = filterProductsByPrice(
  [
    { asin: 'A', price: '£30.00', priceValue: 30 },
    { asin: 'B', price: '£60.00', priceValue: 60 },
    { asin: 'C', price: '£120.00', priceValue: 120 },
  ],
  { minPrice: 50, maxPrice: 100 }
);
const rangeOk =
  rangeFiltered.length === 1 &&
  rangeFiltered[0].asin === 'B';
console.log(`${rangeOk ? 'OK' : 'FAIL'}: min/max price filter`);
if (rangeOk) passed++;

console.log(`\n${passed}/${priceTests.length + 2} tests passed`);
process.exit(passed === priceTests.length + 2 ? 0 : 1);
