import fs from 'fs';
import path from 'path';
import { getConfig } from '../scraper/browser.js';

export function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function exportResults(results, { outputPath, keyword } = {}) {
  const config = getConfig();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = outputPath
    ? path.basename(outputPath, path.extname(outputPath))
    : `results_${sanitizeFilename(keyword || 'scrape')}_${timestamp}`;

  const outputDir = outputPath
    ? path.dirname(outputPath)
    : config.outputDir;

  ensureDir(outputDir);

  const jsonPath = outputPath?.endsWith('.json')
    ? outputPath
    : path.join(outputDir, `${baseName}.json`);

  const csvPath = outputPath?.endsWith('.csv')
    ? outputPath
    : path.join(outputDir, `${baseName}.csv`);

  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
  fs.writeFileSync(csvPath, toCsv(results), 'utf-8');

  return { jsonPath, csvPath };
}

function toCsv(rows) {
  if (rows.length === 0) {
    return 'keyword,asin,title,price,delivery,deliveryText,deliveryDaysMin,deliveryDaysMax,fulfillment,sellerId,sellerName,businessName,businessAddress,matchedProvince,productUrl,sellerUrl,scrapedAt\n';
  }

  const headers = [
    'keyword',
    'asin',
    'title',
    'price',
    'delivery',
    'deliveryText',
    'deliveryDaysMin',
    'deliveryDaysMax',
    'fulfillment',
    'sellerId',
    'sellerName',
    'businessName',
    'businessAddress',
    'matchedProvince',
    'productUrl',
    'sellerUrl',
    'scrapedAt',
  ];

  const lines = [headers.join(',')];

  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h] ?? '')).join(','));
  }

  return lines.join('\n');
}

function escapeCsv(value) {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
}
