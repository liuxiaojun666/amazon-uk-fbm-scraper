# Verify VPN proxy exits in the UK (required for Amazon.co.uk FBM offers)
$Proxy = if ($env:HTTP_PROXY) { $env:HTTP_PROXY } else { "http://127.0.0.1:7897" }

try {
    $country = (Invoke-WebRequest -Uri "https://ipinfo.io/country" -Proxy $Proxy -UseBasicParsing -TimeoutSec 12).Content.Trim()
} catch {
    $country = "unknown"
}

Write-Host "Proxy exit country: $country"

if ($country -eq "GB") {
    Write-Host "OK: UK exit node — ready to scrape"
    exit 0
}

Write-Host "WARN: Not UK (got: $country). Switch VPN to a UK node, then retry."
exit 1
