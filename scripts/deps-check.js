import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function getExpectedPlaywrightVersion(root) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  return pkg.dependencies.playwright.replace(/^[^\d]*/, '');
}

export function getInstalledPlaywrightVersion(root) {
  const pkgPath = join(root, 'node_modules', 'playwright', 'package.json');
  if (!existsSync(pkgPath)) return null;
  return JSON.parse(readFileSync(pkgPath, 'utf8')).version;
}

export function depsInstalled(root) {
  return getInstalledPlaywrightVersion(root) === getExpectedPlaywrightVersion(root);
}
