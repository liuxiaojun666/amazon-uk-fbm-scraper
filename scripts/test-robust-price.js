import { computeRobustPriceRange } from '../src/filters/price.js';

// Simulates tent probe with 1.3M outlier (user's log)
const asc = [475.3, 480, 500, 520, 550, 600, 650, 700, 800, 900];
const desc = [1370107.67, 50000, 25000, 18000, 12000, 9000, 8000, 7500, 7000, 6500];

const range = computeRobustPriceRange(asc, desc);
const ok =
  range &&
  range.min < 600 &&
  range.max < 50000 &&
  range.max > 5000 &&
  range.mid < 30000 &&
  range.rawMax === 1370107.67;

console.log(range);
console.log(ok ? 'OK: outlier trimmed' : 'FAIL: robust range');
process.exit(ok ? 0 : 1);
