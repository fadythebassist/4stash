export function normalizeUrl(urlStr?: string): string | undefined {
  const trimmed = urlStr?.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function isFacebookUrl(urlStr?: string): boolean {
  const normalized = normalizeUrl(urlStr);
  if (!normalized) return false;

  try {
    const hostname = new URL(normalized).hostname.toLowerCase();
    return hostname.includes("facebook.com") || hostname.includes("fb.watch");
  } catch {
    return false;
  }
}

export function cleanFacebookUrl(urlStr?: string): string | undefined {
  const normalized = normalizeUrl(urlStr);
  if (!normalized) return undefined;

  try {
    const url = new URL(normalized);
    const hostname = url.hostname.toLowerCase();
    if (!hostname.includes("facebook.com") && !hostname.includes("fb.watch")) {
      return normalized;
    }

    if (url.pathname.toLowerCase().startsWith("/login") || url.pathname.toLowerCase().startsWith("/checkpoint")) {
      const next = url.searchParams.get("next");
      if (next) {
        try {
          return cleanFacebookUrl(decodeURIComponent(next));
        } catch {
          return cleanFacebookUrl(next);
        }
      }
    }

    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_name",
      "utm_term",
      "utm_content",
      "utm_campaign",
      "ref",
      "ref_source",
      "context",
      "share_id",
      "sh",
      "rdid",
      "share_url",
      "mibextid",
      "__cft__",
      "__tn__",
    ];

    for (const param of trackingParams) {
      url.searchParams.delete(param);
    }

    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";

    return url.toString();
  } catch {
    return normalized;
  }
}
