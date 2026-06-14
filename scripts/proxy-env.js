const PROXY = 'http://127.0.0.1:7897';

/** Apply VPN proxy env vars (read by Playwright / Node). */
export function applyProxyEnv() {
  for (const key of ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY']) {
    if (!process.env[key]) process.env[key] = PROXY;
  }
}

export function proxyUrl() {
  return process.env.HTTP_PROXY || process.env.http_proxy || PROXY;
}
