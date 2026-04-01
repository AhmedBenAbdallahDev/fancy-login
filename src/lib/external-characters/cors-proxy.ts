/**
 * CORS Proxy utilities for external character sources
 * Some sources require proxy due to CORS restrictions
 */

// Proxy types
export const PROXY_TYPES = {
  CORSPROXY_IO: "corsproxy_io",
  CORS_LOL: "cors_lol",
  INTERNAL: "internal",
} as const;

export type ProxyType = (typeof PROXY_TYPES)[keyof typeof PROXY_TYPES];

/**
 * Build a proxied URL for CORS-restricted resources
 */
export function buildProxyUrl(
  proxyType: ProxyType,
  targetUrl: string,
): string | null {
  if (!targetUrl) return null;

  switch (proxyType) {
    case PROXY_TYPES.CORSPROXY_IO:
      return `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    case PROXY_TYPES.CORS_LOL:
      return `https://api.cors.lol/?url=${encodeURIComponent(targetUrl)}`;
    case PROXY_TYPES.INTERNAL:
      return `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
    default:
      return null;
  }
}

/**
 * Fetch with automatic CORS proxy fallback
 */
export async function proxiedFetch(
  url: string,
  options: {
    service?: string;
    fetchOptions?: RequestInit;
    useProxy?: boolean;
  } = {},
): Promise<Response> {
  const { fetchOptions = {}, useProxy = true } = options;

  // Try direct fetch first (works server-side)
  if (typeof window === "undefined" || !useProxy) {
    return fetch(url, {
      ...fetchOptions,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        ...fetchOptions.headers,
      },
    });
  }

  // Client-side: use proxy chain
  const proxyChain: ProxyType[] = [
    PROXY_TYPES.INTERNAL,
    PROXY_TYPES.CORSPROXY_IO,
    PROXY_TYPES.CORS_LOL,
  ];

  let lastError: Error | null = null;

  for (const proxyType of proxyChain) {
    try {
      const proxyUrl = buildProxyUrl(proxyType, url);
      if (!proxyUrl) continue;

      const response = await fetch(proxyUrl, fetchOptions);
      if (response.ok) {
        return response;
      }
    } catch (error) {
      lastError = error as Error;
      console.warn(`[Proxy] ${proxyType} failed for ${url}:`, error);
    }
  }

  throw lastError || new Error(`All proxies failed for ${url}`);
}

/**
 * Fetch an image with automatic CORS proxy fallback
 * Returns blob or null
 */
export async function fetchImageWithProxy(
  imageUrl: string,
): Promise<Blob | null> {
  if (!imageUrl) return null;

  // Try direct fetch first
  try {
    const response = await fetch(imageUrl);
    if (response.ok) {
      return await response.blob();
    }
  } catch {
    // Fall through to proxy
  }

  // Try proxy chain
  const proxyChain: ProxyType[] = [
    PROXY_TYPES.CORSPROXY_IO,
    PROXY_TYPES.CORS_LOL,
  ];

  for (const proxyType of proxyChain) {
    try {
      const proxyUrl = buildProxyUrl(proxyType, imageUrl);
      if (!proxyUrl) continue;

      const response = await fetch(proxyUrl);
      if (response.ok) {
        return await response.blob();
      }
    } catch (error) {
      console.warn(`[Image Proxy] ${proxyType} failed:`, error);
    }
  }

  return null;
}
