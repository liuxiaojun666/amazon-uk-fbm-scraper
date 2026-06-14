import {
  classifySellerOrigin,
  extractSellerNameFromSearchCard,
  hasChineseIndicators,
  isConfidentlyNonChineseSellerName,
  shouldSkipDeepScan,
} from '../src/filters/chinese-seller.js';

const cases = [
  ['沙坪坝区明坤商贸经营部', 'chinese'],
  ['dengzhoushijipengshangmaoyouxiangongsi', 'chinese'],
  ['WANGXUEPINGXIAOTIEJIANG', 'chinese'],
  ['Dafei store', 'unknown'],
  ['Blacks', 'unknown'],
  ['Ventura UK', 'non_chinese'],
  ['MQUAD SOLUTIONS LLC', 'non_chinese'],
  ['Feisika(Shenzhen) Technology Co., Ltd', 'chinese'],
  ['Tiny Land UK', 'non_chinese'],
  ['Awhat', 'unknown'],
];

let passed = 0;
for (const [name, expected] of cases) {
  const result = classifySellerOrigin({ sellerName: name });
  const ok = result === expected;
  console.log(`${ok ? 'OK' : 'FAIL'}: ${name} => ${result} (expected ${expected})`);
  if (ok) passed++;
}

const addressCases = [
  ['联芳街道, 石小路148号附11号第二层1-1-316（自编号）, 重庆', 'chinese'],
  ['Unit 3, Weald Hall Commercial Centre Thornwood, EPPING', 'non_chinese'],
  ['2210 Ashley Oaks Cir, WESLEY CHAPEL, FL', 'non_chinese'],
];

for (const [address, expected] of addressCases) {
  const result = classifySellerOrigin({ businessAddress: address });
  const ok = result === expected;
  console.log(`${ok ? 'OK' : 'FAIL'}: address "${address.slice(0, 40)}..." => ${result}`);
  if (ok) passed++;
}

const extract = extractSellerNameFromSearchCard(
  'Camping Tent Sold by Blacks FREE delivery Wed 17 Jun'
);
console.log(`${extract === 'Blacks' ? 'OK' : 'FAIL'}: extract seller name => ${extract}`);

console.log(`\n${passed}/${cases.length + addressCases.length} passed`);
