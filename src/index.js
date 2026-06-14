import { Command } from 'commander';
import dotenv from 'dotenv';
import { runScrape } from './run-scrape.js';

dotenv.config();

const program = new Command();

program
  .name('amazon-uk-fbm-scraper')
  .description('Scrape Amazon UK for FBM products from Chinese sellers in target provinces')
  .argument('[keyword]', 'Search keyword')
  .option('-k, --keyword <keyword>', 'Search keyword')
  .option('-f, --keywords-file <path>', 'File with one keyword per line')
  .option('-o, --output <path>', 'Output file path (json or csv base name)')
  .option('--headed', 'Run browser in headed mode (useful for CAPTCHA)', false)
  .option('--all-fbm', 'Export all matching offers, not only target provinces', false)
  .option(
    '--exclude-provinces <names>',
    'Exclude provinces (comma-separated), export all other matched Chinese provinces, e.g. 广东,江苏,浙江,上海'
  )
  .option('--province-mode <mode>', 'Province filter: include, exclude, or all', 'include')
  .option('--fulfillment <types>', 'Fulfillment filter: fbm, fba, fbm,fba, or all (default: fbm)', 'fbm')
  .option('--limit <number>', 'Max products to deep-scan per keyword; pre-scan skips do not count (0 = no limit)', '0')
  .option('--min-price <number>', 'Minimum price (e.g. 50 for £50+)')
  .option('--max-price <number>', 'Maximum price (e.g. 200 for up to £200)')
  .option('--min-delivery-days <number>', 'Minimum delivery days (e.g. 5)')
  .option('--max-delivery-days <number>', 'Maximum delivery days (e.g. 30)')
  .option('--postcode <code>', 'UK delivery postcode (default: London SW1A 1AA)')
  .option('--no-postcode', 'Skip setting delivery postcode')
  .option('--skip-proxy-check', 'Skip UK VPN exit verification')
  .parse(process.argv);

const options = program.opts();
const positionalKeyword = program.args.length > 0 ? program.args.join(' ') : null;

function toScrapeOptions() {
  return {
    keyword: options.keyword || positionalKeyword || undefined,
    keywordsFile: options.keywordsFile,
    output: options.output,
    headed: options.headed,
    allFbm: options.allFbm,
    provinceMode: options.provinceMode,
    excludeProvinces: options.excludeProvinces,
    fulfillment: options.fulfillment,
    limit: options.limit,
    minPrice: options.minPrice,
    maxPrice: options.maxPrice,
    minDeliveryDays: options.minDeliveryDays,
    maxDeliveryDays: options.maxDeliveryDays,
    postcode: options.postcode,
    noPostcode: options.noPostcode,
    skipProxyCheck: options.skipProxyCheck,
  };
}

async function main() {
  const scrapeOptions = toScrapeOptions();

  if (!scrapeOptions.keyword && !scrapeOptions.keywordsFile) {
    program.help();
    process.exit(1);
  }

  await runScrape(scrapeOptions);
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
