import { createWriteStream, existsSync, mkdirSync, rmSync, chmodSync, statSync, readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { homedir, platform } from 'os';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import https from 'https';
import http from 'http';
import { createSpinner } from './spinner.js';
import { assertNodeVersion } from './check-node.js';

const MIRRORS = [
  'https://cdn.npmmirror.com/binaries/playwright',
  'https://npmmirror.com/mirrors/playwright',
];

/** playwright-core does not export browsers.json — read from disk */
function loadChromiumMeta() {
  const require = createRequire(import.meta.url);
  const corePkg = require.resolve('playwright-core/package.json');
  const { browsers } = JSON.parse(readFileSync(join(dirname(corePkg), 'browsers.json'), 'utf8'));
  const chromium = browsers.find((b) => b.name === 'chromium');
  if (!chromium) throw new Error('chromium not found in playwright-core/browsers.json');
  return chromium;
}

function getBrowsersPath() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (platform() === 'win32') {
    return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'ms-playwright');
  }
  return join(homedir(), '.cache', 'ms-playwright');
}

function chromeExePath(cacheDir) {
  if (platform() === 'win32') return join(cacheDir, 'chrome-win', 'chrome.exe');
  if (platform() === 'darwin') {
    const folder = process.arch === 'arm64' ? 'chrome-mac-arm64' : 'chrome-mac';
    return join(cacheDir, folder, 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
  }
  return join(cacheDir, 'chrome-linux', 'chrome');
}

function zipSuffix(revision) {
  if (platform() === 'win32') return `builds/chromium/${revision}/chromium-win64.zip`;
  if (platform() === 'darwin') {
    return process.arch === 'arm64'
      ? `builds/chromium/${revision}/chromium-mac-arm64.zip`
      : `builds/chromium/${revision}/chromium-mac.zip`;
  }
  return `builds/chromium/${revision}/chromium-linux.zip`;
}

function getDirSize(dir) {
  let total = 0;
  try {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      total += st.isDirectory() ? getDirSize(p) : st.size;
    }
  } catch {
    /* directory may be partially written */
  }
  return total;
}

function downloadFile(url, dest) {
  const client = url.startsWith('https') ? https : http;
  const spinner = createSpinner('Downloading Chromium...');
  spinner.start();

  return new Promise((resolve, reject) => {
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        spinner.fail(`Download failed (HTTP ${res.statusCode})`);
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }

      const total = Number(res.headers['content-length'] || 0);
      let done = 0;
      const file = createWriteStream(dest);

      res.on('data', (chunk) => {
        done += chunk.length;
        if (total > 0) {
          const pct = Math.min(100, Math.round((done / total) * 100));
          spinner.update(
            `Downloading Chromium... ${pct}% (${(done / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB)`,
          );
        }
      });

      res.pipe(file);
      file.on('finish', () => {
        file.close();
        spinner.stop('Download complete');
        resolve();
      });
      file.on('error', (err) => {
        spinner.fail('Download failed');
        reject(err);
      });
    }).on('error', (err) => {
      spinner.fail('Download failed');
      reject(err);
    });
  });
}

function extractZip(zipPath, destDir) {
  const zipSize = statSync(zipPath).size;
  // Chromium zip compresses ~2.5x; use extracted folder size as rough progress
  const estimatedExtracted = zipSize * 2.5;
  const spinner = createSpinner('Extracting Chromium... 0%');
  spinner.start();

  return new Promise((resolve, reject) => {
    const child =
      platform() === 'win32'
        ? spawn(
            'powershell.exe',
            [
              '-NoProfile',
              '-Command',
              `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
            ],
            { stdio: 'ignore', windowsHide: true },
          )
        : spawn('unzip', ['-o', zipPath, '-d', destDir], { stdio: 'ignore' });

    const poll = setInterval(() => {
      const extracted = getDirSize(destDir);
      const pct = Math.min(95, Math.round((extracted / estimatedExtracted) * 100));
      spinner.update(`Extracting Chromium... ~${pct}% (please wait, 2-5 min on Windows)`);
    }, 400);

    child.on('error', (err) => {
      clearInterval(poll);
      spinner.fail('Extraction failed');
      reject(err);
    });

    child.on('close', (code) => {
      clearInterval(poll);
      if (code !== 0) {
        spinner.fail(`Extraction failed (exit ${code})`);
        reject(new Error(`Extract failed (exit ${code})`));
        return;
      }
      spinner.stop('Extraction complete');
      resolve();
    });
  });
}

export async function ensureChromiumBrowser() {
  assertNodeVersion();
  const { revision, browserVersion } = loadChromiumMeta();
  const browsersPath = getBrowsersPath();
  const cacheDir = join(browsersPath, `chromium-${revision}`);
  const chromeExe = chromeExePath(cacheDir);

  if (existsSync(chromeExe)) {
    console.log(`Chromium ${browserVersion} already installed.`);
    return;
  }

  console.log(`Installing Chromium ${browserVersion} (playwright build v${revision})...`);
  const suffix = zipSuffix(revision);
  const zipDest = join(browsersPath, `_chromium-${revision}.zip`);

  mkdirSync(browsersPath, { recursive: true });
  if (existsSync(cacheDir)) rmSync(cacheDir, { recursive: true, force: true });
  mkdirSync(cacheDir, { recursive: true });

  let ok = false;
  for (const host of MIRRORS) {
    try {
      await downloadFile(`${host}/${suffix}`, zipDest);
      ok = true;
      break;
    } catch (e) {
      console.log(`  Mirror failed (${host}): ${e.message}`);
    }
  }
  if (!ok) {
    console.log('  Trying official Playwright CDN...');
    await downloadFile(`https://playwright.azureedge.net/${suffix}`, zipDest);
  }

  await extractZip(zipDest, cacheDir);
  rmSync(zipDest, { force: true });

  if (!existsSync(chromeExe)) {
    throw new Error(`Chromium not found after extract: ${chromeExe}`);
  }
  if (platform() !== 'win32') chmodSync(chromeExe, 0o755);
  console.log('Chromium ready.');
}
