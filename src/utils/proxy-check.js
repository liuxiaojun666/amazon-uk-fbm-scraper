/**
 * Verify exit country is UK (required for Amazon.co.uk FBM offers).
 */
export async function checkProxyCountry(proxyUrl) {
  const url = proxyUrl || process.env.HTTP_PROXY || process.env.http_proxy || '';

  try {
    const { execSync } = await import('child_process');
    const curlArgs = url
      ? `curl -s --max-time 12 -x ${url} https://ipinfo.io/country`
      : 'curl -s --max-time 12 https://ipinfo.io/country';
    const country = execSync(curlArgs, { encoding: 'utf-8' }).trim();
    const via = url ? 'Proxy' : 'Direct';

    if (country === 'GB') {
      return { ok: true, country, message: `${via} exit: United Kingdom` };
    }

    return {
      ok: false,
      country,
      message: `${via} exit: ${country || 'unknown'} — switch VPN to a UK node (amazon.co.uk needs UK delivery)`,
    };
  } catch (error) {
    if (!url) {
      return {
        ok: false,
        country: null,
        message: `Direct connection check failed: ${error.message} — enable UK VPN, or set HTTP_PROXY if using Clash`,
      };
    }
    return {
      ok: false,
      country: null,
      message: `Proxy check failed: ${error.message} — if Chrome works without proxy, set DISABLE_PROXY=true in .env`,
    };
  }
}
