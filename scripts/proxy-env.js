export function isProxyDisabled() {
  const v = String(process.env.DISABLE_PROXY || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Legacy: no-op unless HTTP_PROXY already set in .env (no auto-inject). */
export function applyProxyEnv() {
  if (isProxyDisabled()) {
    for (const key of ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY']) {
      delete process.env[key];
    }
  }
}

export function proxyUrl() {
  if (isProxyDisabled()) return '';
  return process.env.HTTP_PROXY || process.env.http_proxy || '';
}
