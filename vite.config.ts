import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function extractMetadata(html: string): { title?: string; description?: string; image?: string } {
  const metas = html.match(/<meta\s+[^>]*>/gi) ?? [];
  const map = new Map<string, string>();

  for (const tag of metas) {
    const keyMatch = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i);
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    if (!keyMatch || !contentMatch) continue;
    const key = keyMatch[1].trim().toLowerCase();
    const content = decodeHtmlEntities(contentMatch[1].trim());
    if (!map.has(key) && content) map.set(key, content);
  }

  const titleFromOg = map.get('og:title') || map.get('twitter:title');
  const descriptionFromOg = map.get('og:description') || map.get('twitter:description') || map.get('description');
  const imageFromOg =
    map.get('og:image:secure_url') ||
    map.get('og:image:url') ||
    map.get('og:image') ||
    map.get('twitter:image');

  let title = titleFromOg;
  if (!title) {
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleTag?.[1]) title = decodeHtmlEntities(titleTag[1].trim());
  }

  // Some proxies return key/value text like "og:title: ..." instead of HTML meta tags
  if (!title || !descriptionFromOg || !imageFromOg) {
    const lines = html.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*(og:title|twitter:title|title)\s*:\s*(.+)\s*$/i);
      if (m && !title) {
        title = decodeHtmlEntities(m[2].trim());
        continue;
      }
      const d = line.match(/^\s*(og:description|twitter:description|description)\s*:\s*(.+)\s*$/i);
      if (d && !descriptionFromOg) {
        map.set(d[1].toLowerCase(), decodeHtmlEntities(d[2].trim()));
        continue;
      }
      const i = line.match(/^\s*(og:image|twitter:image)\s*:\s*(https?:\/\/\S+)/i);
      if (i && !imageFromOg) {
        map.set(i[1].toLowerCase(), i[2].trim());
      }
    }
  }

  const description =
    descriptionFromOg || map.get('og:description') || map.get('twitter:description') || map.get('description');
  const image =
    imageFromOg ||
    map.get('og:image:secure_url') ||
    map.get('og:image:url') ||
    map.get('og:image') ||
    map.get('twitter:image');

  return {
    title,
    description,
    image
  };
}

function isGenericInstagramTitle(title?: string): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (t === 'instagram') return true;
  if (t.includes('403')) return true;
  if (t.includes('forbidden')) return true;
  if (t.includes('access denied')) return true;
  if (t.includes('not available')) return true;
  if (t.includes('log in') || t.includes('login') || t.includes('sign up')) return true;
  if (t === 'instagram • photos and videos') return true;
  return false;
}

function cleanInstagramText(input?: string): string | undefined {
  if (!input) return undefined;
  let t = decodeHtmlEntities(input)
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return undefined;

  // Remove common "Likes/Comments" prefix
  t = t.replace(/^\d+\s+Likes,\s+\d+\s+Comments\s+-\s+/i, '').trim();
  t = t.replace(/^\d+\s+likes,\s+\d+\s+comments\s+-\s+/i, '').trim();
  return t || undefined;
}

function isGenericInstagramDescription(desc?: string): boolean {
  const d = (desc ?? '').trim().toLowerCase();
  if (!d) return true;
  if (d.includes('log in') || d.includes('login') || d.includes('sign up')) return true;
  if (d.includes('instagram')) return false; // captions often mention instagram; don't discard
  return false;
}

function isGenericFacebookTitle(title?: string): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (t === '403') return true;
  if (t === 'error') return true;
  if (t === 'error facebook') return true;
  if (t === 'facebook') return true;
  if (t.includes('403')) return true;
  if (t.includes('forbidden')) return true;
  if (t.includes('access denied')) return true;
  if (t.includes('log in') || t.includes('login') || t.includes('sign up')) return true;
  if (t.includes('not available') || t.includes('content not found')) return true;
  if (t.includes('something went wrong')) return true;
  return false;
}

function shouldProxyImageHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h.includes('instagram.com') ||
    h.endsWith('fbcdn.net') ||
    h.includes('facebook.com') ||
    // Facebook crawler thumbnails often come from lookaside.fbsbx.com and are CORP-protected.
    // Proxying them makes them render reliably in our UI.
    h.endsWith('fbsbx.com')
  );
}

function isFacebookShareLike(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (!host.includes('facebook.com') && !host.includes('fb.watch')) return false;
  if (path.startsWith('/sharer/sharer.php')) return true;
  if (path.startsWith('/share.php')) return true;
  if (path.includes('/share/')) return true;
  if (host.includes('fb.watch')) return true;
  if (path.includes('/permalink.php')) return true;
  return false;
}

function extractFacebookSharedTarget(url: URL): URL | null {
  const uParam = url.searchParams.get('u') || url.searchParams.get('url');
  if (!uParam) return null;
  try {
    return new URL(uParam);
  } catch {
    return null;
  }
}

async function followRedirectsWithHeadThenGet(
  startUrl: string,
  headers: Record<string, string>,
  timeoutMs: number,
  limit: number = 5
): Promise<string> {
  let current = startUrl;
  for (let i = 0; i < limit; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const headRes = await fetch(current, {
        method: 'HEAD',
        redirect: 'follow',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const finalHeadUrl = headRes.url || current;
      if (finalHeadUrl !== current) {
        current = finalHeadUrl;
        continue;
      }
      if (headRes.ok) return finalHeadUrl;
    } catch {
      // ignore and fallback to GET
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const getRes = await fetch(current, {
        method: 'GET',
        redirect: 'follow',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const finalGetUrl = getRes.url || current;
      if (finalGetUrl !== current) {
        current = finalGetUrl;
        continue;
      }
      return finalGetUrl;
    } catch {
      return current;
    }
  }
  return current;
}

function tryParseJson(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function* walkJson(node: any): Generator<any> {
  if (node === null || node === undefined) return;
  yield node;
  if (Array.isArray(node)) {
    for (const v of node) yield* walkJson(v);
  } else if (typeof node === 'object') {
    for (const v of Object.values(node)) yield* walkJson(v);
  }
}

function extractInstagramCaptionFromJsonLd(html: string): string | undefined {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  for (const block of blocks) {
    const m = block.match(/>\s*([\s\S]*?)\s*<\/script>/i);
    if (!m?.[1]) continue;
    const raw = m[1].trim();
    const parsed = tryParseJson(raw);
    if (!parsed) continue;

    for (const node of walkJson(parsed)) {
      if (!node || typeof node !== 'object') continue;

      const candidates = [
        node.caption,
        node.articleBody,
        node.description,
        node.text,
        node.headline,
        node.name
      ].filter((v) => typeof v === 'string') as string[];

      for (const c of candidates) {
        const cleaned = cleanInstagramText(c);
        if (cleaned && cleaned.length >= 5) return cleaned;
      }
    }
  }
  return undefined;
}

function extractInstagramCaptionFromHtml(html: string): string | undefined {
  // Heuristic: look for "caption" fields in embedded JSON.
  const patterns = [
    /"caption"\s*:\s*\{[^}]*"text"\s*:\s*"([^"]+)"/i,
    /"edge_media_to_caption"\s*:\s*\{[\s\S]*?"text"\s*:\s*"([^"]+)"/i,
    /"accessibility_caption"\s*:\s*"([^"]+)"/i
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const unescaped = m[1].replace(/\\n/g, ' ').replace(/\\u003c/g, '<').replace(/\\u003e/g, '>');
      const cleaned = cleanInstagramText(unescaped);
      if (cleaned && cleaned.length >= 5) return cleaned;
    }
  }
  return undefined;
}

async function tryInstagramJson(targetUrl: URL): Promise<{ description?: string; image?: string } | null> {
  try {
    const base = `${targetUrl.origin}${targetUrl.pathname.replace(/\/?$/, '/')}`;
    const jsonUrl = `${base}?__a=1&__d=dis`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(jsonUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        accept: 'application/json,text/plain,*/*',
        'accept-language': 'en-US,en;q=0.9'
      }
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const data: any = await res.json();

    // Common shapes observed historically
    const media = data?.graphql?.shortcode_media ?? data?.items?.[0];
    if (!media) return null;

    const captionText =
      media?.edge_media_to_caption?.edges?.[0]?.node?.text ??
      media?.caption?.text ??
      media?.caption?.text ??
      undefined;

    const imageUrl = media?.display_url ?? media?.image_versions2?.candidates?.[0]?.url ?? undefined;

    return {
      description: typeof captionText === 'string' ? captionText : undefined,
      image: typeof imageUrl === 'string' ? imageUrl : undefined
    };
  } catch {
    return null;
  }
}

function extractInstagramShortcode(u: URL): { kind: 'p' | 'reel' | 'tv'; code: string } | null {
  const m = u.pathname.match(/\/(p|reel|tv)\/([^/?#]+)/i);
  if (!m?.[1] || !m?.[2]) return null;
  const kind = m[1].toLowerCase() as 'p' | 'reel' | 'tv';
  const code = m[2];
  return { kind, code };
}

function buildInstagramMediaFallbackUrl(u: URL): string | null {
  const sc = extractInstagramShortcode(u);
  if (!sc) return null;
  // Instagram's legacy media endpoint is most consistently reachable under /p/<shortcode>/...
  // even when the original URL is /reel/<shortcode>/ or /tv/<shortcode>/.
  return `https://www.instagram.com/p/${sc.code}/media/?size=l`;
}

async function fetchTextWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; finalUrl: string; contentType: string; text: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(url, { redirect: 'follow', signal: controller.signal, headers });
  clearTimeout(timeoutId);
  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    finalUrl: res.url || url,
    contentType: res.headers.get('content-type') || '',
    text
  };
}

async function resolveFacebookShareUrlWithTimeout(
  targetUrl: URL,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<string | null> {
  const host = targetUrl.hostname.toLowerCase();
  const path = targetUrl.pathname.toLowerCase();
  
  // Handle fb.watch short links
  if (host.includes('fb.watch')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(targetUrl.toString(), {
        redirect: 'follow',
        signal: controller.signal,
        headers
      });
      clearTimeout(timeoutId);
      // After following redirects, res.url should be the final URL
      if (res.url && res.url !== targetUrl.toString()) {
        return res.url;
      }
    } catch {
      // ignore
    }
    return null;
  }
  
  if (!host.includes('facebook.com') || !path.includes('/share/')) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // First try: follow redirects to get final URL
    const followRes = await fetch(targetUrl.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers
    });
    clearTimeout(timeoutId);
    
    // If we got redirected to a different URL, use that
    if (followRes.url && followRes.url !== targetUrl.toString() && !followRes.url.includes('/share/')) {
      return followRes.url;
    }

    // Parse the response for redirect hints
    const text = await followRes.text().catch(() => '');
    
    // Look for og:url which often has the canonical post URL
    const ogUrl = text.match(/<meta\s+[^>]*property\s*=\s*["']og:url["'][^>]*content\s*=\s*["']([^"']+)["']/i);
    if (ogUrl?.[1] && !ogUrl[1].includes('/share/')) {
      try {
        return new URL(ogUrl[1], targetUrl.toString()).toString();
      } catch {
        // ignore
      }
    }
    
    // Look for canonical link
    const canonical = text.match(/<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["']/i);
    if (canonical?.[1] && !canonical[1].includes('/share/')) {
      try {
        return new URL(canonical[1], targetUrl.toString()).toString();
      } catch {
        // ignore
      }
    }

    // Look for meta refresh redirect
    const metaRefresh = text.match(/http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*["'][^"']*url=([^"'>\s]+)["']/i);
    if (metaRefresh?.[1] && !metaRefresh[1].includes('/share/')) {
      try {
        return new URL(metaRefresh[1], targetUrl.toString()).toString();
      } catch {
        // ignore
      }
    }
    
    // Look for JavaScript redirect patterns in the HTML
    const jsRedirect = text.match(/window\.location\s*=\s*["']([^"']+)["']/i) ||
                       text.match(/location\.href\s*=\s*["']([^"']+)["']/i) ||
                       text.match(/"redirect_url"\s*:\s*"([^"]+)"/i);
    if (jsRedirect?.[1] && !jsRedirect[1].includes('/share/')) {
      try {
        const decoded = jsRedirect[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/');
        return new URL(decoded, targetUrl.toString()).toString();
      } catch {
        // ignore
      }
    }

  } catch {
    return null;
  }

  return null;
}

function unfurlPlugin(): Plugin {
  const handler = async (req: any, res: any) => {
    try {
      const url = new URL(req.url ?? '', 'http://localhost');
      if (url.pathname !== '/api/unfurl' && url.pathname !== '/api/proxy-image') return false;

      // Image proxy (helps when third-party cookies prevent Instagram images from loading in <img>)
      if (url.pathname === '/api/proxy-image') {
        if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return true;
        }

        const target = url.searchParams.get('url');
        const debug = url.searchParams.get('debug') === '1';
        if (!target) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing url param' }));
          return true;
        }

        let targetUrl: URL;
        try {
          targetUrl = new URL(target);
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid url param' }));
          return true;
        }

        if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Only http/https URLs are allowed' }));
          return true;
        }

        const isFacebookImageHost = (() => {
          const h = targetUrl.hostname.toLowerCase();
          return h.endsWith('fbsbx.com') || h.endsWith('fbcdn.net') || h.includes('facebook.com');
        })();

        const headers = {
          'user-agent': isFacebookImageHost
            ? 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
            : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          // Some Facebook image endpoints are sensitive to Referer.
          ...(isFacebookImageHost ? { referer: 'https://www.facebook.com/' } : {})
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const upstream = await fetch(targetUrl.toString(), {
          redirect: 'follow',
          signal: controller.signal,
          headers
        });
        clearTimeout(timeoutId);

        const contentType = upstream.headers.get('content-type') || '';
        if (!upstream.ok || !contentType.toLowerCase().startsWith('image/')) {
          res.statusCode = 422;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(
            JSON.stringify({
              error: 'Upstream did not return an image',
              status: upstream.status,
              contentType,
              url: upstream.url || targetUrl.toString(),
              ...(debug
                ? {
                    debug: {
                      headers: {
                        'content-type': upstream.headers.get('content-type'),
                        location: upstream.headers.get('location')
                      }
                    }
                  }
                : {})
            })
          );
          return true;
        }

        const buf = Buffer.from(await upstream.arrayBuffer());
        // safety cap ~8MB
        if (buf.byteLength > 8 * 1024 * 1024) {
          res.statusCode = 413;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ error: 'Image too large' }));
          return true;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'no-store');
        res.end(buf);
        return true;
      }
      if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return true;
      }

      const target = url.searchParams.get('url');
      const debug = url.searchParams.get('debug') === '1';
      if (!target) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing url param' }));
        return true;
      }

      let targetUrl: URL;
      try {
        targetUrl = new URL(target);
      } catch {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid url param' }));
        return true;
      }

      if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Only http/https URLs are allowed' }));
        return true;
      }

      const headers = {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9'
      };

      // Facebook often serves different HTML/redirect behavior depending on the user agent.
      // For /share/* links specifically, a link-preview UA tends to get the canonical target URL.
      const facebookPreviewHeaders = {
        ...headers,
        'user-agent':
          'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
      };

      const isFacebook = targetUrl.hostname.includes('facebook.com') || targetUrl.hostname.includes('fb.watch');
      const isFacebookShare = isFacebook && isFacebookShareLike(targetUrl);

      // Resolve Facebook share links: extract ?u= target or follow redirects. Do not scrape Facebook pages directly.
      let shareResolvedUrl: string | null = null;
      if (isFacebookShare) {
        const extracted = extractFacebookSharedTarget(targetUrl);
        if (extracted) {
          shareResolvedUrl = extracted.toString();
          targetUrl = extracted;
        } else {
          const resolvedByHelper = await resolveFacebookShareUrlWithTimeout(targetUrl, facebookPreviewHeaders, 10000);
          if (resolvedByHelper) {
            shareResolvedUrl = resolvedByHelper;
            try {
              targetUrl = new URL(resolvedByHelper);
            } catch {
              // keep original
            }
          } else {
            const resolved = await followRedirectsWithHeadThenGet(
              targetUrl.toString(),
              facebookPreviewHeaders,
              8000,
              5
            );
            shareResolvedUrl = resolved;
            try {
              targetUrl = new URL(resolved);
            } catch {
              // keep original
            }
          }
        }
      }

      const primary = await fetchTextWithTimeout(
        targetUrl.toString(),
        isFacebookShare ? facebookPreviewHeaders : headers,
        10000
      );
      let finalUrl = primary.finalUrl;
      let contentType = primary.contentType;
      let meta = extractMetadata(primary.text);

      const attempts: Record<string, any> = {
        primary: { ok: primary.ok, status: primary.status, contentType },
        shareResolve: { attempted: isFacebookShare, url: shareResolvedUrl },
        instagramJson: { attempted: false, ok: false },
        jina: { attempted: false, ok: false },
        fallbackMediaUrl: { attempted: false, used: false },
        facebookJina: { attempted: false, ok: false }
      };

      // Instagram often returns a login/blocked page with generic metadata.
      // Try JSON endpoint first, then fall back to a text-proxy fetch.
      const isInstagram = targetUrl.hostname.includes('instagram.com');
      if (isInstagram && (isGenericInstagramTitle(meta.title) || !meta.image || !meta.description)) {
        // Try to extract caption/snippet from HTML if OG tags are missing.
        if (!meta.description || isGenericInstagramDescription(meta.description)) {
          const fromLd = extractInstagramCaptionFromJsonLd(primary.text);
          const fromHtml = extractInstagramCaptionFromHtml(primary.text);
          meta.description = cleanInstagramText(fromLd || fromHtml || meta.description) || meta.description;
        } else {
          meta.description = cleanInstagramText(meta.description) || meta.description;
        }

        attempts.instagramJson.attempted = true;
        const ig = await tryInstagramJson(targetUrl);
        attempts.instagramJson.ok = !!ig;
        if (ig?.description && (!meta.description || isGenericInstagramDescription(meta.description))) {
          meta.description = cleanInstagramText(ig.description) || ig.description;
        }
        if (ig?.image && !meta.image) meta.image = ig.image;

        if (isGenericInstagramTitle(meta.title)) {
          meta.title = undefined;
        }

        if (!meta.image || !meta.description) {
          const jinaUrl = `https://r.jina.ai/${targetUrl.toString()}`;
          attempts.jina.attempted = true;
          const proxied = await fetchTextWithTimeout(jinaUrl, headers, 10000);
          attempts.jina.ok = proxied.ok;
          // keep finalUrl/contentType from original
          const proxyMeta = extractMetadata(proxied.text);
          if (!meta.title && proxyMeta.title && !isGenericInstagramTitle(proxyMeta.title)) meta.title = proxyMeta.title;
          if (!meta.description && proxyMeta.description) meta.description = cleanInstagramText(proxyMeta.description) || proxyMeta.description;
          if (!meta.image && proxyMeta.image) meta.image = proxyMeta.image;

          if (!meta.description) {
            const proxyLd = extractInstagramCaptionFromJsonLd(proxied.text);
            const proxyHtml = extractInstagramCaptionFromHtml(proxied.text);
            meta.description = cleanInstagramText(proxyLd || proxyHtml) || meta.description;
          }
        }

        // Last-resort: Instagram legacy media endpoint (may still be blocked, but sometimes works)
        if (!meta.image) {
          attempts.fallbackMediaUrl.attempted = true;
          const fallback = buildInstagramMediaFallbackUrl(targetUrl);
          if (fallback) {
            meta.image = fallback;
            attempts.fallbackMediaUrl.used = true;
          }
        }
      }

      const isFacebookHost = targetUrl.hostname.includes('facebook.com') || targetUrl.hostname.includes('fb.watch');

      // Try Facebook oEmbed API first for better metadata
      if (isFacebookHost && (!meta.title || !meta.description || !meta.image)) {
        const appId = process.env.VITE_FACEBOOK_APP_ID;
        const appSecret = process.env.VITE_FACEBOOK_APP_SECRET;
        
        if (appId && appSecret) {
          attempts.facebookOembed = { attempted: true, ok: false };
          try {
            const accessToken = `${appId}|${appSecret}`;
            const oembedUrl = `https://graph.facebook.com/v19.0/oembed_post?url=${encodeURIComponent(targetUrl.toString())}&access_token=${encodeURIComponent(accessToken)}&fields=author_name,author_url,provider_name,provider_url,type,width,height,html`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const oembedRes = await fetch(oembedUrl, {
              signal: controller.signal,
              headers: {
                'accept': 'application/json'
              }
            });
            clearTimeout(timeoutId);
            
            if (oembedRes.ok) {
              const oembedData: any = await oembedRes.json();
              attempts.facebookOembed.ok = true;
              
              // Extract metadata from oEmbed response with proper HTML entity decoding
              // Title: use author_name or extract from HTML
              if (!meta.title && oembedData.author_name) {
                meta.title = decodeHtmlEntities(oembedData.author_name);
              } else if (!meta.title && oembedData.html) {
                // Try to extract text content from HTML
                const textMatch = oembedData.html.match(/>([^<]+)</);
                if (textMatch?.[1]) {
                  meta.title = decodeHtmlEntities(textMatch[1].trim());
                }
              }
              
              // Description: extract from HTML content and decode entities
              if (!meta.description && oembedData.html) {
                // Remove HTML tags and get text content
                let descText = oembedData.html
                  .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                // Decode HTML entities (&#x627; → actual characters)
                if (descText) {
                  meta.description = decodeHtmlEntities(descText);
                }
              }
              
              // Image: oEmbed doesn't provide direct image URLs, so we'll rely on OG tags
              // but we can try to extract from the HTML iframe src
              if (!meta.image && oembedData.html) {
                const srcMatch = oembedData.html.match(/src=["']([^"']+)["']/);
                if (srcMatch?.[1]) {
                  attempts.facebookOembed.iframeSrc = srcMatch[1];
                  // Note: iframe src won't give us an image, but we log it for debugging
                }
              }
            }
          } catch {
            // Ignore oEmbed errors and fall back
          }
        }

        // Fallback to Jina if oEmbed didn't provide enough data
        if (!meta.title || !meta.description || !meta.image) {
          attempts.facebookJina = { attempted: true, ok: false };
          try {
            const jinaUrl = `https://r.jina.ai/${targetUrl.toString()}`;
            const proxied = await fetchTextWithTimeout(jinaUrl, headers, 10000);
            attempts.facebookJina.ok = proxied.ok;
            const fbMeta = extractMetadata(proxied.text);
            if (!meta.title && fbMeta.title && !isGenericFacebookTitle(fbMeta.title)) meta.title = fbMeta.title;
            if (!meta.description && fbMeta.description) meta.description = fbMeta.description;
            if (!meta.image && fbMeta.image) meta.image = fbMeta.image;
          } catch {
            // ignore
          }
        }
      }

      // If Facebook host is still empty after fallback, return early without thumbnail/description
      if (isFacebookHost && !meta.title && !meta.description && !meta.image) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(
          JSON.stringify({
            url: targetUrl.toString(),
            contentType,
            status: primary.status,
            title: undefined,
            description: undefined,
            image: undefined,
            shareResolvedUrl,
            ...(debug ? { debug: { attempts } } : {})
          })
        );
        return true;
      }

      const image = meta.image ? new URL(meta.image, finalUrl).toString() : undefined;
      const proxiedImage = (() => {
        if (!image) return undefined;
        try {
          const host = new URL(image).hostname;
          return shouldProxyImageHost(host) ? `/api/proxy-image?url=${encodeURIComponent(image)}` : image;
        } catch {
          return image;
        }
      })();

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(
        JSON.stringify({
          url: finalUrl,
          contentType,
          status: primary.status,
          title: meta.title,
          description: meta.description,
          image: proxiedImage,
          ...(debug
            ? {
                debug: {
                  isInstagram,
                  attempts,
                  extracted: {
                    hasTitle: !!meta.title,
                    hasDescription: !!meta.description,
                    hasImage: !!meta.image
                  }
                }
              }
            : {})
        })
      );
      return true;
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(
        JSON.stringify({
          error: err?.name === 'AbortError' ? 'Upstream timeout' : 'Unfurl failed'
        })
      );
      return true;
    }
  };

  return {
    name: '4later-unfurl',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handler(req, res);
        if (!handled) next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handler(req, res);
        if (!handled) next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    unfurlPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: '4Later',
        short_name: '4Later',
        description: 'Save and organize multimedia content for later',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ],
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url'
          }
        }
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
