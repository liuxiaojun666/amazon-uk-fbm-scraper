import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { depsInstalled } from './deps-check.js';
import { runNpmInstall, runPlaywrightInstall } from './npm-env.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function chromiumInstalled() {
  try {
    const { chromium } = await import('playwright');
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

if (!depsInstalled(root)) {
  console.log('Installing npm dependencies (npmmirror)...');
  runNpmInstall(root);
} else {
  await import('./setup-env.js');
}

if (!(await chromiumInstalled())) {
  console.log('Installing Playwright Chromium...');
  await runPlaywrightInstall(root);
}
