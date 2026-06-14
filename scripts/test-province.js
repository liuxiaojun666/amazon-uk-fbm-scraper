import {
  matchProvince,
  evaluateProvinceFilter,
  buildProvinceFilter,
  isTargetProvince,
} from '../src/filters/province.js';

const matchCases = [
  ['河南省郑州市金水区', '河南'],
  ['Shaanxi Province, Xi\'an', '陕西'],
  ['山西省太原市', '山西'],
  ['河北省石家庄市', '河北'],
  ['Shanxi Province, Taiyuan', '山西'],
  ['广东省深圳市', '广东'],
  ['江苏省南京市', '江苏'],
  ['浙江省杭州市', '浙江'],
  ['上海市浦东新区', '上海'],
  ['', null],
];

let passed = 0;
for (const [address, expected] of matchCases) {
  const result = matchProvince(address);
  const ok = result === expected;
  console.log(`${ok ? 'OK' : 'FAIL'}: match "${address}" => ${result} (expected ${expected})`);
  if (ok) passed++;
}

const excludeFilter = buildProvinceFilter({
  excludeProvinces: '广东,江苏,浙江,上海',
});

const excludeCases = [
  ['广东省深圳市', false],
  ['江苏省南京市', false],
  ['浙江省杭州市', false],
  ['上海市浦东新区', false],
  ['山西省太原市', true],
  ['河南省郑州市', true],
  ['北京市朝阳区', true],
  ['', false],
];

for (const [address, expected] of excludeCases) {
  const result = evaluateProvinceFilter(address, excludeFilter).export;
  const ok = result === expected;
  console.log(`${ok ? 'OK' : 'FAIL'}: exclude "${address}" => ${result} (expected ${expected})`);
  if (ok) passed++;
}

const includeOk = isTargetProvince('山西省太原市') && !isTargetProvince('广东省深圳市');
console.log(`${includeOk ? 'OK' : 'FAIL'}: isTargetProvince include mode`);
if (includeOk) passed++;

const total = matchCases.length + excludeCases.length + 1;
console.log(`\n${passed}/${total} province tests passed`);
process.exit(passed === total ? 0 : 1);
