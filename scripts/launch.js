import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { applyProxyEnv } from './proxy-env.js';
import { assertNodeVersion } from './check-node.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
const args = process.argv.slice(3);

assertNodeVersion();

if (mode !== 'web' && mode !== 'scrape') {
  console.error('Usage: node scripts/launch.js <web|scrape> [args...]');
  process.exit(1);
}

await import('./ensure-deps.js');

const { default: dotenv } = await import('dotenv');
dotenv.config({ path: join(root, '.env') });
applyProxyEnv();

const target = mode === 'web' ? 'server/index.js' : 'src/index.js';
const result = spawnSync(process.execPath, [join(root, target), ...args], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
