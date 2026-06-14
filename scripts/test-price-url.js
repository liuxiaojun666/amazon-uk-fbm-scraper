import { buildSearchUrl } from '../src/scraper/browser.js';

const url = buildSearchUrl('tent', 1, { sort: 'price-asc-rank' });
const url2 = buildSearchUrl('tent', 2, { minPrice: 1050, sort: 'price-desc-rank' });

const ok1 = url.includes('s=price-asc-rank') && url.includes('k=tent');
const ok2 = url2.includes('low-price=1050') && url2.includes('page=2');

console.log(ok1 ? 'OK' : 'FAIL', 'asc sort url:', url);
console.log(ok2 ? 'OK' : 'FAIL', 'low-price url:', url2);

const url3 = buildSearchUrl('tent', 1, { minPrice: 100 });
const ok3 = url3.includes('low-price=100');

console.log(ok3 ? 'OK' : 'FAIL', 'min-price url:', url3);
process.exit(ok1 && ok2 && ok3 ? 0 : 1);
