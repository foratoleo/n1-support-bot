/**
 * URL validation utilities
 */

/**
 * Validates that a URL is safe for PageSpeed testing
 * - Must be valid HTTP or HTTPS URL
 * - Cannot be localhost or private IP addresses (security check)
 * - Must be under 2048 characters
 */
export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Check protocol
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    // Check hostname exists
    if (!url.hostname) {
      return false;
    }

    // Security check: disallow localhost
    if (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '::1'
    ) {
      return false;
    }

    // Security check: disallow private IP ranges
    if (isPrivateIP(url.hostname)) {
      return false;
    }

    // Check URL length
    if (urlString.length > 2048) {
      return false;
    }

    return true;
  } catch (_error) {
    // URL constructor throws on invalid URLs
    return false;
  }
}

/**
 * Checks if a hostname is a private IP address
 */
function isPrivateIP(hostname: string): boolean {
  // IPv4 private ranges
  const ipv4PrivateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./, // Link-local
  ];

  for (const range of ipv4PrivateRanges) {
    if (range.test(hostname)) {
      return true;
    }
  }

  // IPv6 private ranges (simplified check)
  if (hostname.includes(':')) {
    // Link-local (fe80::/10)
    if (hostname.toLowerCase().startsWith('fe80')) {
      return true;
    }
    // Unique local (fc00::/7)
    if (hostname.toLowerCase().startsWith('fc') || hostname.toLowerCase().startsWith('fd')) {
      return true;
    }
  }

  return false;
}
