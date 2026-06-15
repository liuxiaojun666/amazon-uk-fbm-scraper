import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = join(root, 'release');
const { version } = createRequire(import.meta.url)(join(root, 'package.json'));
const zipName = `amazon-uk-fbm-scraper-${version}.zip`;
const zipPath = join(releaseDir, zipName);

mkdirSync(releaseDir, { recursive: true });
if (existsSync(zipPath)) unlinkSync(zipPath);

const excludes = [
  '.git/*',
  '.git/**',
  'node_modules/*',
  'node_modules/**',
  '.env',
  'data/*',
  'data/**',
  'cache/*',
  'cache/**',
  'release/*',
  'release/**',
  '.cursor/*',
  '.cursor/**',
  '*.log',
  '.DS_Store',
  '*/.DS_Store',
  '*.zip',
];

const excludeArgs = excludes.flatMap((pattern) => ['-x', pattern]);
execFileSync('zip', ['-r', zipPath, '.', ...excludeArgs], { cwd: root, stdio: 'inherit' });

if (!existsSync(zipPath)) {
  console.error('Pack failed: zip not created');
  process.exit(1);
}

console.log(`\nPacked: release/${zipName}`);
