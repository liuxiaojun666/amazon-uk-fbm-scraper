/**
 * Verify VPN proxy exits in the UK (required for Amazon.co.uk FBM offers).
 */
export async function checkProxyCountry(proxyUrl) {
  const url = proxyUrl || process.env.HTTP_PROXY || process.env.http_proxy || '';
  if (!url) {
    return { ok: false, country: null, message: 'No HTTP_PROXY configured — amazon.co.uk may be unreachable' };
  }

  try {
    const { execSync } = await import('child_process');
    const country = execSync(`curl -s --max-time 12 -x ${url} https://ipinfo.io/country`, {
      encoding: 'utf-8',
    }).trim();

    if (country === 'GB') {
      return { ok: true, country, message: 'Proxy exits in United Kingdom' };
    }

    return {
      ok: false,
      country,
      message: `Proxy exits in ${country || 'unknown'} — switch VPN to a UK node (amazon.co.uk needs UK delivery)`,
    };
  } catch (error) {
    return { ok: false, country: null, message: `Proxy check failed: ${error.message}` };
  }
}
