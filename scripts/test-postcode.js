import { formatUkPostcode } from '../src/scraper/location.js';

const cases = [
  ['london', 'SW1A 1AA'],
  ['SW1A1AA', 'SW1A 1AA'],
  ['e1 6an', 'E1 6AN'],
  ['', 'SW1A 1AA'],
];

let passed = 0;
for (const [input, expected] of cases) {
  const result = formatUkPostcode(input);
  const ok = result === expected;
  console.log(`${ok ? 'OK' : 'FAIL'}: "${input}" => "${result}" (expected "${expected}")`);
  if (ok) passed++;
}

console.log(`\n${passed}/${cases.length} passed`);
process.exit(passed === cases.length ? 0 : 1);
