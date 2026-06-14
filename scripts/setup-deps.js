import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: 'inherit' });
}

async function chromiumInstalled() {
  try {
    const { chromium } = await import('playwright');
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

const hasPlaywright = existsSync(join(root, 'node_modules', 'playwright', 'package.json'));

if (!hasPlaywright) {
  console.log('Installing npm dependencies...');
  run('npm install');
} else {
  await import('./setup-env.js');
}

if (!(await chromiumInstalled())) {
  console.log('Installing Playwright Chromium...');
  run('npx playwright install chromium');
}

console.log('Dependencies ready.');
