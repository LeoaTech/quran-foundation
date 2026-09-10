const { URL } = require('url');
const dns = require('dns');
const { promisify } = require('util');

const dnsResolve = promisify(dns.resolve4);

/**
 * SSRF-safe image download utility.
 *
 * Validates URLs before downloading to prevent server-side request forgery.
 * Supports Google Drive view links by converting them to direct download URLs.
 *
 * Checks:
 *  1. URL must be https://
 *  2. Hostname resolved to public IPs only (blocks private/reserved ranges)
 *  3. Max 2 redirects (each redirect target re-validated)
 *  4. Configurable timeout (default 10s)
 *  5. Max download size (default 5MB)
 */

// Private / reserved IP ranges to block
const PRIVATE_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // CGNAT
];

function isPrivateIP(ip) {
  return PRIVATE_RANGES.some((re) => re.test(ip));
}

/**
 * Convert Google Drive view/share links to direct download URLs.
 * Supports:
 *   https://drive.google.com/file/d/{fileId}/view
 *   https://drive.google.com/open?id={fileId}
 */
function normalizeGoogleDriveUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.hostname !== 'drive.google.com') return urlStr;

    // /file/d/{id}/view pattern
    const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (fileMatch) {
      return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
    }

    // /open?id={id} pattern
    const openId = parsed.searchParams.get('id');
    if (parsed.pathname === '/open' && openId) {
      return `https://drive.google.com/uc?export=download&id=${openId}`;
    }
  } catch {
    // Not a valid URL — return as-is, will fail downstream validation
  }
  return urlStr;
}

/**
 * Download a file from a URL with SSRF protections.
  */
async function ssrfSafeDownload(url, {
  maxSizeBytes = 5 * 1024 * 1024,
  timeoutMs = 10000,
  maxRedirects = 2,
} = {}) {
  // Normalize Google Drive URLs
  let targetUrl = normalizeGoogleDriveUrl(url);

  for (let redirect = 0; redirect <= maxRedirects; redirect++) {
    // 1. Must be https://
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      throw new Error(`Invalid URL: ${targetUrl}`);
    }

    if (parsed.protocol !== 'https:') {
      throw new Error(`Only HTTPS URLs are allowed. Got: ${parsed.protocol}`);
    }

    // 2. Resolve DNS and block private IPs
    let ips;
    try {
      ips = await dnsResolve(parsed.hostname);
    } catch {
      throw new Error(`DNS resolution failed for: ${parsed.hostname}`);
    }

    for (const ip of ips) {
      if (isPrivateIP(ip)) {
        throw new Error(`URL resolves to private/reserved IP (${ip}). Blocked for security.`);
      }
    }

    // 3. Fetch with timeout and redirect: manual
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'manual',      // handle redirects ourselves
        headers: {
          'User-Agent': 'QuranFoundation-LMS/1.0 ImportWorker',
        },
      });
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`Download timed out after ${timeoutMs}ms: ${targetUrl}`);
      }
      throw new Error(`Download failed: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    // Handle redirects manually (re-validate each target)
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect without Location header');

      // Resolve relative URLs
      targetUrl = new URL(location, targetUrl).href;
      continue; // loop re-validates the new URL
    }

    if (!response.ok) {
      throw new Error(`Download failed (HTTP ${response.status}): ${targetUrl}`);
    }

    // 4. Check Content-Length if available
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > maxSizeBytes) {
      throw new Error(`File too large (${contentLength} bytes). Max: ${maxSizeBytes} bytes.`);
    }

    // 5. Stream body with size enforcement
    const chunks = [];
    let totalSize = 0;

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;
      if (totalSize > maxSizeBytes) {
        reader.cancel();
        throw new Error(`Download exceeds max size (${maxSizeBytes} bytes). Aborted.`);
      }
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return { buffer, contentType };
  }

  throw new Error(`Too many redirects (max ${maxRedirects})`);
}

module.exports = {
  ssrfSafeDownload,
  normalizeGoogleDriveUrl,
  isPrivateIP,
};
