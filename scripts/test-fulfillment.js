import {
  parseFulfillmentOption,
  parseAllOffersFromPage,
  filterOffersByFulfillment,
  parseBuyBoxMerchant,
  parseSearchListingFulfillment,
  classifyFulfillment,
} from '../src/filters/fbm.js';

let passed = 0;

// FBA: sold by + fulfilled by amazon (must NOT be FBM)
const fbaOffer = classifyFulfillment({
  soldBy: 'Sold by WENZEFZZB',
  shipsFrom: 'Fulfilled by Amazon',
});
if (fbaOffer.isFba && !fbaOffer.isFbm) {
  console.log('OK: FBA sold by + fulfilled by Amazon');
  passed++;
} else {
  console.log('FAIL: FBA classification', fbaOffer);
}

// FBM: dispatched from and sold by
const fbmOffer = classifyFulfillment({
  fulfillmentText: 'Dispatched from and sold by Portal Outdoors',
});
if (fbmOffer.isFbm && !fbmOffer.isFba) {
  console.log('OK: FBM dispatched from and sold by');
  passed++;
} else {
  console.log('FAIL: FBM classification', fbmOffer);
}

// Bug case: only "Sold by" with sellerId — must NOT be FBM
const soldOnly = parseAllOffersFromPage([
  {
    fulfillmentText: 'Sold by WENZEFZZB',
    sellerId: 'A20JK0RNRLY6S',
    sellerName: 'WENZEFZZB',
    price: '',
    condition: 'New',
    shipsFrom: '',
    soldBy: 'Sold by WENZEFZZB',
  },
]);
const fbmFiltered = filterOffersByFulfillment(soldOnly, ['FBM']);
if (fbmFiltered.length === 0) {
  console.log('OK: sold-by-only not treated as FBM');
  passed++;
} else {
  console.log('FAIL: sold-by-only incorrectly marked FBM');
}

const buyBoxFba = parseBuyBoxMerchant({
  fulfilledByText: 'Fulfilled by Amazon',
  soldByText: 'Sold by WENZEFZZB',
  text: 'Fulfilled by Amazon | Sold by WENZEFZZB',
  sellerId: 'A20JK0RNRLY6S',
  sellerName: 'WENZEFZZB',
});
if (buyBoxFba?.isFba && !buyBoxFba?.isFbm) {
  console.log('OK: buy box FBA (WENZEFZZB case)');
  passed++;
} else {
  console.log('FAIL: buy box FBA', buyBoxFba);
}

// FBM: separate Dispatches from + Sold by (UK AOD pinned offer)
const fbmSplitOffer = classifyFulfillment({
  shipsFrom: 'Dispatches from zhuhaishifeilongqingjieyouxiangongsi',
  soldBy: 'Sold by zhuhaishifeilongqingjieyouxiangongsi',
});
if (fbmSplitOffer.isFbm && !fbmSplitOffer.isFba) {
  console.log('OK: FBM dispatches from + sold by (split fields)');
  passed++;
} else {
  console.log('FAIL: FBM split fields', fbmSplitOffer);
}

// FBM: Shipper / Seller buy box label
const fbmShipperSeller = classifyFulfillment({
  soldBy: 'Shipper / Seller zhuhaishifeilongqingjieyouxiangongsi',
});
if (fbmShipperSeller.isFbm && !fbmShipperSeller.isFba) {
  console.log('OK: FBM shipper / seller');
  passed++;
} else {
  console.log('FAIL: FBM shipper / seller', fbmShipperSeller);
}

const buyBoxFbm = parseBuyBoxMerchant({
  fulfilledByText: '',
  soldByText: 'Shipper / Seller zhuhaishifeilongqingjieyouxiangongsi',
  text: 'Shipper / Seller zhuhaishifeilongqingjieyouxiangongsi',
  sellerId: 'A115GYYJEFIYMY',
  sellerName: 'zhuhaishifeilongqingjieyouxiangongsi',
});
if (buyBoxFbm?.isFbm && !buyBoxFbm?.isFba) {
  console.log('OK: buy box FBM (shipper/seller case)');
  passed++;
} else {
  console.log('FAIL: buy box FBM', buyBoxFbm);
}

// Search listing: paid delivery + merchantId => FBM
const searchFbm = parseSearchListingFulfillment({
  sellerId: 'A115GYYJEFIYMY',
  deliveryText: '£9.99 delivery 29 Jun - 3 Jul',
  cardText: 'Tent Canopy...',
});
if (searchFbm.isFbm && !searchFbm.isFba && searchFbm.sellerId === 'A115GYYJEFIYMY') {
  console.log('OK: search listing paid delivery => FBM');
  passed++;
} else {
  console.log('FAIL: search listing FBM', searchFbm);
}

// Search listing: FREE delivery only — must NOT infer FBM
const searchFree = parseSearchListingFulfillment({
  sellerId: 'A28OTXSQ1W0W4T',
  deliveryText: 'FREE delivery 13 - 22 Jul',
  cardText: 'Luxury Dome Tent',
});
if (!searchFree.isFbm && !searchFree.isFba) {
  console.log('OK: search FREE delivery not auto-FBM');
  passed++;
} else {
  console.log('FAIL: search FREE delivery incorrectly classified', searchFree);
}

const types = parseFulfillmentOption('fbm,fba');
if (types.join() === 'FBM,FBA') passed++;

console.log(`\n${passed}/10 passed`);
process.exit(passed === 10 ? 0 : 1);
