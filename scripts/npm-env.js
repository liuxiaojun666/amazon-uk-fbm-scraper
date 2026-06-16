import { execSync, spawnSync } from 'child_process';
import { platform } from 'os';

/** 国内用户默认走淘宝 npm 镜像，无需登录 */
export const NPM_REGISTRY = 'https://registry.npmmirror.com/';

const PROXY_KEYS = ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'all_proxy'];

const isWin = platform() === 'win32';

function withoutProxy(env) {
  const copy = { ...env };
  for (const key of PROXY_KEYS) delete copy[key];
  return copy;
}

/** npm / Playwright 下载不走 VPN 代理（代理仅用于爬取 Amazon） */
function installEnv(extra = {}) {
  return withoutProxy(npmEnv(extra));
}

export function npmEnv(extra = {}) {
  return {
    ...process.env,
    npm_config_registry: NPM_REGISTRY,
    npm_config_fetch_timeout: '120000',
    ...extra,
  };
}

function warnUnsafePath(root) {
  if (isWin && /[^\x00-\x7F]/.test(root)) {
    console.error('');
    console.error('ERROR: Project path contains Chinese or special characters.');
    console.error('npm cannot install here. Please double-click 启动 Web.bat again');
    console.error('(it will auto-copy to an English path), or move the folder to e.g. C:\\amazon-scraper');
    console.error('');
    process.exit(1);
  }
}

function runCmdSync(cmd, root, env) {
  if (isWin) {
    const result = spawnSync('cmd.exe', ['/d', '/s', '/c', cmd], {
      cwd: root,
      stdio: 'inherit',
      env,
      windowsHide: true,
    });
    if (result.status !== 0) {
      const err = new Error(`Command failed (${result.status}): ${cmd}`);
      err.status = result.status;
      throw err;
    }
    return;
  }
  execSync(cmd, { cwd: root, stdio: 'inherit', env });
}

/** Windows: run via cmd.exe to avoid "Exit handler never called" */
export function runNpm(cmd, root) {
  warnUnsafePath(root);
  runCmdSync(cmd, root, installEnv());
}

export function runNpmInstall(root) {
  const installCmd = 'npm install --no-fund --no-audit --fetch-timeout=120000';
  try {
    runNpm(installCmd, root);
  } catch {
    console.log('npm install failed, clearing cache and retrying...');
    try {
      runNpm('npm cache clean --force', root);
    } catch {
      /* ignore cache clean errors */
    }
    runNpm(installCmd, root);
  }
}

export async function runPlaywrightInstall(root) {
  warnUnsafePath(root);
  const { ensureChromiumBrowser } = await import('./install-chromium.js');
  await ensureChromiumBrowser();
}
