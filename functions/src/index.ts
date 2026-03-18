import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

const FB_APP_ID = defineSecret("FB_APP_ID");
const FB_APP_SECRET = defineSecret("FB_APP_SECRET");

// ---------------------------------------------------------------------------
// Helpers (ported from vite.config.ts unfurl middleware)
// ---------------------------------------------------------------------------

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function extractMetadata(html: string): {
  title?: string;
  description?: string;
  image?: string;
} {
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

  const titleFromOg = map.get("og:title") || map.get("twitter:title");
  const descriptionFromOg =
    map.get("og:description") ||
    map.get("twitter:description") ||
    map.get("description");
  const imageFromOg =
    map.get("og:image:secure_url") ||
    map.get("og:image:url") ||
    map.get("og:image") ||
    map.get("twitter:image");

  let title = titleFromOg;
  if (!title) {
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleTag?.[1]) title = decodeHtmlEntities(titleTag[1].trim());
  }

  if (!title || !descriptionFromOg || !imageFromOg) {
    const lines = html.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*(og:title|twitter:title|title)\s*:\s*(.+)\s*$/i);
      if (m && !title) { title = decodeHtmlEntities(m[2].trim()); continue; }
      const d = line.match(/^\s*(og:description|twitter:description|description)\s*:\s*(.+)\s*$/i);
      if (d && !descriptionFromOg) { map.set(d[1].toLowerCase(), decodeHtmlEntities(d[2].trim())); continue; }
      const i = line.match(/^\s*(og:image|twitter:image)\s*:\s*(https?:\/\/\S+)/i);
      if (i && !imageFromOg) { map.set(i[1].toLowerCase(), i[2].trim()); }
    }
  }

  const description = descriptionFromOg || map.get("og:description") || map.get("twitter:description") || map.get("description");
  const image = imageFromOg || map.get("og:image:secure_url") || map.get("og:image:url") || map.get("og:image") || map.get("twitter:image");
  return { title, description, image };
}

function isGenericInstagramTitle(title?: string): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (t === "instagram") return true;
  if (t.includes("403") || t.includes("forbidden") || t.includes("access denied")) return true;
  if (t.includes("not available")) return true;
  if (t.includes("log in") || t.includes("login") || t.includes("sign up")) return true;
  if (t === "instagram • photos and videos") return true;
  return false;
}

function cleanInstagramText(input?: string): string | undefined {
  if (!input) return undefined;
  let t = decodeHtmlEntities(input).replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  t = t.replace(/^\d+\s+Likes,\s+\d+\s+Comments\s+-\s+/i, "").trim();
  t = t.replace(/^\d+\s+likes,\s+\d+\s+comments\s+-\s+/i, "").trim();
  return t || undefined;
}

function isGenericInstagramDescription(desc?: string): boolean {
  const d = (desc ?? "").trim().toLowerCase();
  if (!d) return true;
  if (d.includes("log in") || d.includes("login") || d.includes("sign up")) return true;
  if (d.includes("instagram")) return false;
  return false;
}

function isGenericFacebookTitle(title?: string): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (t === "403" || t === "error" || t === "error facebook" || t === "facebook") return true;
  if (t.includes("403") || t.includes("forbidden") || t.includes("access denied")) return true;
  if (t.includes("log in") || t.includes("login") || t.includes("sign up")) return true;
  if (t.includes("not available") || t.includes("content not found")) return true;
  if (t.includes("something went wrong")) return true;
  return false;
}

function shouldProxyImageHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    (h.includes("instagram.com") && !h.includes("cdninstagram.com")) ||
    h.endsWith("fbcdn.net") ||
    h.includes("facebook.com") ||
    h.endsWith("fbsbx.com")
  );
}

function isFacebookShareLike(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (!host.includes("facebook.com") && !host.includes("fb.watch")) return false;
  if (path.startsWith("/sharer/sharer.php")) return true;
  if (path.startsWith("/share.php")) return true;
  if (path.includes("/share/")) return true;
  if (host.includes("fb.watch")) return true;
  if (path.includes("/permalink.php")) return true;
  return false;
}

function extractFacebookSharedTarget(url: URL): URL | null {
  const uParam = url.searchParams.get("u") || url.searchParams.get("url");
  if (!uParam) return null;
  try { return new URL(uParam); } catch { return null; }
}

// Node.js-native HTTP fetch (Cloud Functions don't have the browser fetch API in Node 18-,
// but Node 20 does. We use the built-in fetch if available, otherwise fall back to http/https.)
async function nodeFetch(
  urlStr: string,
  opts: { method?: string; headers?: Record<string, string>; timeoutMs?: number; redirect?: "follow" | "manual" } = {}
): Promise<{ ok: boolean; status: number; finalUrl: string; text: () => Promise<string>; arrayBuffer: () => Promise<ArrayBuffer>; headers: Map<string, string> }> {
  // Node 20 has globalThis.fetch — use it when available
  if (typeof globalThis.fetch === "function") {
    const controller = new AbortController();
    const tid = opts.timeoutMs ? setTimeout(() => controller.abort(), opts.timeoutMs) : null;
    try {
      const res = await (globalThis.fetch as typeof fetch)(urlStr, {
        method: opts.method ?? "GET",
        headers: opts.headers,
        redirect: opts.redirect ?? "follow",
        signal: controller.signal,
      });
      if (tid) clearTimeout(tid);
      const headersMap = new Map<string, string>();
      res.headers.forEach((v, k) => headersMap.set(k.toLowerCase(), v));
      return {
        ok: res.ok,
        status: res.status,
        finalUrl: res.url || urlStr,
        text: () => res.text(),
        arrayBuffer: () => res.arrayBuffer(),
        headers: headersMap,
      };
    } catch (e) {
      if (tid) clearTimeout(tid);
      throw e;
    }
  }

  // Fallback: Node http/https
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const lib: typeof https | typeof http = parsedUrl.protocol === "https:" ? https : http;
    const reqOpts = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: opts.method ?? "GET",
      headers: opts.headers ?? {},
    };
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const req = lib.request(reqOpts, (res) => {
      if (timeoutId) clearTimeout(timeoutId);
      const finalUrl = res.headers.location || urlStr;
      const headersMap = new Map<string, string>();
      for (const [k, v] of Object.entries(res.headers)) {
        if (v) headersMap.set(k.toLowerCase(), Array.isArray(v) ? v[0] : v);
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        resolve({
          ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
          status: res.statusCode ?? 0,
          finalUrl,
          text: async () => buf.toString("utf8"),
          arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
          headers: headersMap,
        });
      });
      res.on("error", reject);
    });
    if (opts.timeoutMs) {
      timeoutId = setTimeout(() => { req.destroy(); reject(new Error("Timeout")); }, opts.timeoutMs);
    }
    req.on("error", reject);
    req.end();
  });
}

async function fetchTextWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; finalUrl: string; contentType: string; text: string }> {
  const res = await nodeFetch(url, { headers, timeoutMs });
  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    finalUrl: res.finalUrl,
    contentType: res.headers.get("content-type") || "",
    text,
  };
}

async function resolveFacebookShareUrl(targetUrl: URL, headers: Record<string, string>, timeoutMs: number): Promise<string | null> {
  const host = targetUrl.hostname.toLowerCase();
  const path = targetUrl.pathname.toLowerCase();

  if (host.includes("fb.watch")) {
    try {
      const res = await nodeFetch(targetUrl.toString(), { headers, timeoutMs, redirect: "follow" });
      if (res.finalUrl && res.finalUrl !== targetUrl.toString()) return res.finalUrl;
    } catch { /* ignore */ }
    return null;
  }

  if (!host.includes("facebook.com") || !path.includes("/share/")) return null;

  try {
    const res = await nodeFetch(targetUrl.toString(), { headers, timeoutMs, redirect: "follow" });
    if (res.finalUrl && res.finalUrl !== targetUrl.toString() && !res.finalUrl.includes("/share/")) return res.finalUrl;

    const text = await res.text();
    const ogUrl = text.match(/<meta\s+[^>]*property\s*=\s*["']og:url["'][^>]*content\s*=\s*["']([^"']+)["']/i);
    if (ogUrl?.[1] && !ogUrl[1].includes("/share/")) {
      try { return new URL(ogUrl[1], targetUrl.toString()).toString(); } catch { /* ignore */ }
    }
    const canonical = text.match(/<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["']/i);
    if (canonical?.[1] && !canonical[1].includes("/share/")) {
      try { return new URL(canonical[1], targetUrl.toString()).toString(); } catch { /* ignore */ }
    }
    const jsRedirect = text.match(/window\.location\s*=\s*["']([^"']+)["']/i) || text.match(/location\.href\s*=\s*["']([^"']+)["']/i) || text.match(/"redirect_url"\s*:\s*"([^"]+)"/i);
    if (jsRedirect?.[1] && !jsRedirect[1].includes("/share/")) {
      try {
        const decoded = jsRedirect[1].replace(/\\u002F/g, "/").replace(/\\\//g, "/");
        return new URL(decoded, targetUrl.toString()).toString();
      } catch { /* ignore */ }
    }
  } catch { return null; }
  return null;
}

function tryParseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

function* walkJson(node: unknown): Generator<unknown> {
  if (node === null || node === undefined) return;
  yield node;
  if (Array.isArray(node)) { for (const v of node) yield* walkJson(v); }
  else if (typeof node === "object") { for (const v of Object.values(node as Record<string, unknown>)) yield* walkJson(v); }
}

function extractInstagramCaptionFromJsonLd(html: string): string | undefined {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  for (const block of blocks) {
    const m = block.match(/>\s*([\s\S]*?)\s*<\/script>/i);
    if (!m?.[1]) continue;
    const parsed = tryParseJson(m[1].trim());
    if (!parsed) continue;
    for (const node of walkJson(parsed)) {
      if (!node || typeof node !== "object") continue;
      const obj = node as Record<string, unknown>;
      const candidates = [obj["caption"], obj["articleBody"], obj["description"], obj["text"], obj["headline"], obj["name"]].filter((v) => typeof v === "string") as string[];
      for (const c of candidates) {
        const cleaned = cleanInstagramText(c);
        if (cleaned && cleaned.length >= 5) return cleaned;
      }
    }
  }
  return undefined;
}

function extractInstagramCaptionFromHtml(html: string): string | undefined {
  const patterns = [
    /"caption"\s*:\s*\{[^}]*"text"\s*:\s*"([^"]+)"/i,
    /"edge_media_to_caption"\s*:\s*\{[\s\S]*?"text"\s*:\s*"([^"]+)"/i,
    /"accessibility_caption"\s*:\s*"([^"]+)"/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const unescaped = m[1].replace(/\\n/g, " ").replace(/\\u003c/g, "<").replace(/\\u003e/g, ">");
      const cleaned = cleanInstagramText(unescaped);
      if (cleaned && cleaned.length >= 5) return cleaned;
    }
  }
  return undefined;
}

async function tryInstagramJson(targetUrl: URL): Promise<{ description?: string; image?: string } | null> {
  try {
    const base = `${targetUrl.origin}${targetUrl.pathname.replace(/\/?$/, "/")}`;
    const jsonUrl = `${base}?__a=1&__d=dis`;
    const res = await nodeFetch(jsonUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "application/json,text/plain,*/*",
        "accept-language": "en-US,en;q=0.9",
      },
      timeoutMs: 10000,
    });
    if (!res.ok) return null;
    const data = tryParseJson(await res.text()) as Record<string, unknown> | null;
    if (!data) return null;
    const graphql = data["graphql"] as Record<string, unknown> | undefined;
    const items = data["items"] as unknown[] | undefined;
    const media = (graphql?.["shortcode_media"] ?? items?.[0]) as Record<string, unknown> | undefined;
    if (!media) return null;
    const edgeCaption = (media["edge_media_to_caption"] as Record<string, unknown> | undefined);
    const edges = edgeCaption?.["edges"] as unknown[] | undefined;
    const firstEdge = edges?.[0] as Record<string, unknown> | undefined;
    const firstNode = firstEdge?.["node"] as Record<string, unknown> | undefined;
    const captionObj = media["caption"] as Record<string, unknown> | undefined;
    const captionText = firstNode?.["text"] ?? captionObj?.["text"];
    const imageUrl = media["display_url"] ?? (media["image_versions2"] as Record<string, unknown> | undefined)?.["candidates"];
    return {
      description: typeof captionText === "string" ? captionText : undefined,
      image: typeof imageUrl === "string" ? imageUrl : undefined,
    };
  } catch { return null; }
}

function buildInstagramMediaFallbackUrl(u: URL): string | null {
  const m = u.pathname.match(/\/(p|reel|tv)\/([^/?#]+)/i);
  if (!m?.[1] || !m?.[2]) return null;
  return `https://www.instagram.com/p/${m[2]}/media/?size=l`;
}

// ---------------------------------------------------------------------------
// Main handler (shared between /api/unfurl and /api/proxy-image)
// ---------------------------------------------------------------------------

async function handleRequest(req: functions.https.Request, res: functions.Response<unknown>, fbAppId: string, fbAppSecret: string): Promise<void> {
  // CORS — allow 4later.xyz and localhost dev
  const origin = req.headers["origin"] as string | undefined;
  const allowedOrigins = ["https://4later.xyz", "https://later-production-9a596.web.app", "http://localhost:5173", "http://localhost:4173"];
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://4later.xyz");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

  const path = req.path;

  // -------------------------------------------------------------------------
  // /api/proxy-image
  // -------------------------------------------------------------------------
  if (path === "/proxy-image" || path === "/api/proxy-image") {
    const target = req.query["url"] as string | undefined;
    if (!target) { res.status(400).json({ error: "Missing url param" }); return; }

    let targetUrl: URL;
    try { targetUrl = new URL(target); } catch { res.status(400).json({ error: "Invalid url param" }); return; }
    if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") { res.status(400).json({ error: "Only http/https URLs are allowed" }); return; }

    const h = targetUrl.hostname.toLowerCase();
    const isFbImg = h.endsWith("fbsbx.com") || h.endsWith("fbcdn.net") || h.includes("facebook.com");
    const isIgImg = h.includes("cdninstagram.com") || h.includes("instagram.com");

    const imgHeaders: Record<string, string> = {
      "user-agent": isFbImg
        ? "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
        : isIgImg
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      ...(isFbImg ? { referer: "https://www.facebook.com/" } : {}),
      ...(isIgImg ? { referer: "https://www.instagram.com/" } : {}),
    };

    try {
      const upstream = await nodeFetch(targetUrl.toString(), { headers: imgHeaders, timeoutMs: 10000 });
      const contentType = upstream.headers.get("content-type") || "";
      if (!upstream.ok || !contentType.toLowerCase().startsWith("image/")) {
        res.status(422).json({ error: "Upstream did not return an image", status: upstream.status, contentType });
        return;
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.byteLength > 8 * 1024 * 1024) { res.status(413).json({ error: "Image too large" }); return; }
      res.status(200).setHeader("Content-Type", contentType).setHeader("Cache-Control", "no-store").end(buf);
    } catch (e: unknown) {
      res.status(500).json({ error: e instanceof Error && e.message === "Timeout" ? "Upstream timeout" : "Proxy failed" });
    }
    return;
  }

  // -------------------------------------------------------------------------
  // /api/unfurl
  // -------------------------------------------------------------------------
  if (path !== "/unfurl" && path !== "/api/unfurl") {
    res.status(404).json({ error: "Not found" }); return;
  }

  const target = req.query["url"] as string | undefined;
  const debug = req.query["debug"] === "1";
  if (!target) { res.status(400).json({ error: "Missing url param" }); return; }

  let targetUrl: URL;
  try { targetUrl = new URL(target); } catch { res.status(400).json({ error: "Invalid url param" }); return; }
  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") { res.status(400).json({ error: "Only http/https URLs are allowed" }); return; }

  const headers: Record<string, string> = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
  };
  const facebookPreviewHeaders: Record<string, string> = {
    ...headers,
    "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  };

  const isFacebook = targetUrl.hostname.includes("facebook.com") || targetUrl.hostname.includes("fb.watch");
  const isFacebookShare = isFacebook && isFacebookShareLike(targetUrl);

  let shareResolvedUrl: string | null = null;
  if (isFacebookShare) {
    const extracted = extractFacebookSharedTarget(targetUrl);
    if (extracted) {
      shareResolvedUrl = extracted.toString();
      targetUrl = extracted;
    } else {
      const resolved = await resolveFacebookShareUrl(targetUrl, facebookPreviewHeaders, 10000);
      if (resolved) {
        shareResolvedUrl = resolved;
        try { targetUrl = new URL(resolved); } catch { /* keep original */ }
      }
    }
  }

  const primary = await fetchTextWithTimeout(targetUrl.toString(), isFacebookShare ? facebookPreviewHeaders : headers, 10000);
  const finalUrl = primary.finalUrl;
  const contentType = primary.contentType;
  const meta = extractMetadata(primary.text);

  const attempts: Record<string, unknown> = {
    primary: { ok: primary.ok, status: primary.status, contentType },
    shareResolve: { attempted: isFacebookShare, url: shareResolvedUrl },
    instagramJson: { attempted: false, ok: false },
    jina: { attempted: false, ok: false },
    fallbackMediaUrl: { attempted: false, used: false },
    facebookJina: { attempted: false, ok: false },
    redditJson: { attempted: false, ok: false },
    redditJina: { attempted: false, ok: false },
    threadsJina: { attempted: false, ok: false },
  };

  // Instagram
  const isInstagram = targetUrl.hostname.includes("instagram.com");
  if (isInstagram && (isGenericInstagramTitle(meta.title) || !meta.image || !meta.description)) {
    if (!meta.description || isGenericInstagramDescription(meta.description)) {
      const fromLd = extractInstagramCaptionFromJsonLd(primary.text);
      const fromHtml = extractInstagramCaptionFromHtml(primary.text);
      meta.description = cleanInstagramText(fromLd || fromHtml || meta.description) || meta.description;
    } else {
      meta.description = cleanInstagramText(meta.description) || meta.description;
    }
    attempts["instagramJson"] = { attempted: true, ok: false };
    const ig = await tryInstagramJson(targetUrl);
    (attempts["instagramJson"] as Record<string, unknown>)["ok"] = !!ig;
    if (ig?.description && (!meta.description || isGenericInstagramDescription(meta.description))) {
      meta.description = cleanInstagramText(ig.description) || ig.description;
    }
    if (ig?.image && !meta.image) meta.image = ig.image;
    if (isGenericInstagramTitle(meta.title)) meta.title = undefined;

    if (!meta.image || !meta.description) {
      const jinaUrl = `https://r.jina.ai/${targetUrl.toString()}`;
      attempts["jina"] = { attempted: true, ok: false };
      const proxied = await fetchTextWithTimeout(jinaUrl, headers, 10000);
      (attempts["jina"] as Record<string, unknown>)["ok"] = proxied.ok;
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
    if (!meta.image) {
      attempts["fallbackMediaUrl"] = { attempted: true, used: false };
      const fallback = buildInstagramMediaFallbackUrl(targetUrl);
      if (fallback) { meta.image = fallback; (attempts["fallbackMediaUrl"] as Record<string, unknown>)["used"] = true; }
    }
  }

  const isFacebookHost = targetUrl.hostname.includes("facebook.com") || targetUrl.hostname.includes("fb.watch");

  // Facebook group posts — try mbasic
  const isFacebookGroupPost = isFacebookHost && (() => {
    const p = targetUrl.pathname.toLowerCase();
    return p.includes("/groups/") && (p.includes("/posts/") || p.includes("/permalink/"));
  })();

  if (isFacebookGroupPost && !meta.image) {
    try {
      const mbasicUrl = new URL(targetUrl.toString());
      mbasicUrl.hostname = "mbasic.facebook.com";
      const mbasicRes = await fetchTextWithTimeout(mbasicUrl.toString(), facebookPreviewHeaders, 8000);
      if (mbasicRes.ok) {
        const mbasicMeta = extractMetadata(mbasicRes.text);
        if (mbasicMeta.image) meta.image = mbasicMeta.image;
        if (!meta.title && mbasicMeta.title && !isGenericFacebookTitle(mbasicMeta.title)) meta.title = mbasicMeta.title;
        if (!meta.description && mbasicMeta.description) meta.description = mbasicMeta.description;
        if (!meta.image) {
          const imgMatches = mbasicRes.text.match(/<img\s[^>]*src=["']([^"']+)["'][^>]*>/gi) ?? [];
          for (const imgTag of imgMatches) {
            const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
            if (!srcMatch?.[1]) continue;
            const src = srcMatch[1];
            if (src.includes("static.xx.fbcdn") || src.includes("emoji") || src.includes("reaction") || src.includes("rsrc.php")) continue;
            if (src.startsWith("https://")) { meta.image = src; break; }
          }
        }
      }
    } catch { /* mbasic failed */ }
  }

  // Facebook oEmbed + Jina fallback
  if (isFacebookHost && (!meta.title || !meta.description || !meta.image)) {
    // Secrets set via: firebase functions:secrets:set FB_APP_ID and FB_APP_SECRET
    const appId: string = fbAppId;
    const appSecret: string = fbAppSecret;

    if (appId && appSecret) {
      attempts["facebookOembed"] = { attempted: true, ok: false };
      try {
        const accessToken = `${appId}|${appSecret}`;
        const oembedUrl = `https://graph.facebook.com/v19.0/oembed_post?url=${encodeURIComponent(targetUrl.toString())}&access_token=${encodeURIComponent(accessToken)}&fields=author_name,author_url,provider_name,provider_url,type,width,height,html`;
        const oembedRes = await nodeFetch(oembedUrl, { headers: { accept: "application/json" }, timeoutMs: 8000 });
        if (oembedRes.ok) {
          const oembedData = tryParseJson(await oembedRes.text()) as Record<string, unknown> | null;
          if (oembedData) {
            (attempts["facebookOembed"] as Record<string, unknown>)["ok"] = true;
            if (!meta.title && oembedData["author_name"]) meta.title = decodeHtmlEntities(oembedData["author_name"] as string);
            else if (!meta.title && oembedData["html"]) {
              const textMatch = (oembedData["html"] as string).match(/>([^<]+)</);
              if (textMatch?.[1]) meta.title = decodeHtmlEntities(textMatch[1].trim());
            }
            if (!meta.description && oembedData["html"]) {
              const descText = (oembedData["html"] as string)
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
              if (descText) meta.description = decodeHtmlEntities(descText);
            }
          }
        }
      } catch { /* ignore oEmbed errors */ }
    }

    if (!meta.title || !meta.description || !meta.image) {
      attempts["facebookJina"] = { attempted: true, ok: false };
      try {
        const jinaUrl = `https://r.jina.ai/${targetUrl.toString()}`;
        const proxied = await fetchTextWithTimeout(jinaUrl, headers, 10000);
        (attempts["facebookJina"] as Record<string, unknown>)["ok"] = proxied.ok;
        const fbMeta = extractMetadata(proxied.text);
        if (!meta.title && fbMeta.title && !isGenericFacebookTitle(fbMeta.title)) meta.title = fbMeta.title;
        if (!meta.description && fbMeta.description) meta.description = fbMeta.description;
        if (!meta.image && fbMeta.image) meta.image = fbMeta.image;
      } catch { /* ignore */ }
    }
  }

  // Early return if Facebook still has nothing
  if (isFacebookHost && !meta.title && !meta.description && !meta.image) {
    res.status(200).setHeader("Cache-Control", "no-store").json({
      url: targetUrl.toString(), contentType, status: primary.status,
      title: undefined, description: undefined, image: undefined,
      shareResolvedUrl,
      ...(debug ? { debug: { attempts } } : {}),
    });
    return;
  }

  // Reddit
  const isReddit = targetUrl.hostname.includes("reddit.com") || targetUrl.hostname.includes("redd.it");
  if (isReddit) {
    attempts["redditJson"] = { attempted: true, ok: false };
    try {
      const redditJsonUrl = new URL(targetUrl.toString());
      redditJsonUrl.search = "";
      redditJsonUrl.hash = "";
      if (!redditJsonUrl.pathname.endsWith("/")) redditJsonUrl.pathname += "/";
      const jsonUrl = redditJsonUrl.toString() + ".json";
      const redditHeaders = { ...headers, "user-agent": "Mozilla/5.0 (compatible; 4Later/1.0; +https://4later.app)" };
      const jsonRes = await fetchTextWithTimeout(jsonUrl, redditHeaders, 8000);
      (attempts["redditJson"] as Record<string, unknown>)["ok"] = jsonRes.ok;
      if (jsonRes.ok) {
        const data = tryParseJson(jsonRes.text) as unknown[] | null;
        const post = (data as unknown[])?.[0] as Record<string, unknown> | undefined;
        const postData = post?.["data"] as Record<string, unknown> | undefined;
        const children = postData?.["children"] as unknown[] | undefined;
        const firstChild = children?.[0] as Record<string, unknown> | undefined;
        const p = firstChild?.["data"] as Record<string, unknown> | undefined;
        if (p) {
          if (p["over_18"] === true || p["over18"] === true) {
            const nsfwTitle = p["title"] ? decodeHtmlEntities(p["title"] as string) : "NSFW Reddit Post";
            res.status(200).setHeader("Cache-Control", "no-store").json({
              url: targetUrl.toString(), contentType, status: primary.status,
              title: nsfwTitle, description: "This Reddit post is marked as NSFW (18+)", image: undefined, nsfw: true,
              ...(debug ? { debug: { attempts } } : {}),
            });
            return;
          }
          if (!meta.title && p["title"]) meta.title = decodeHtmlEntities(p["title"] as string);
          if (!meta.description && p["selftext"]) meta.description = decodeHtmlEntities((p["selftext"] as string).replace(/\n+/g, " ").trim().substring(0, 300));
          if (!meta.image) {
            const preview = p["preview"] as Record<string, unknown> | undefined;
            const images = preview?.["images"] as unknown[] | undefined;
            const firstImg = images?.[0] as Record<string, unknown> | undefined;
            const source = firstImg?.["source"] as Record<string, unknown> | undefined;
            if (source?.["url"]) meta.image = decodeHtmlEntities(source["url"] as string).replace(/&amp;/g, "&");
            else if (p["thumbnail"] && (p["thumbnail"] as string).startsWith("http")) meta.image = p["thumbnail"] as string;
            else if (p["url"] && ((p["url"] as string).match(/\.(jpg|jpeg|png|gif|webp)$/i) || p["post_hint"] === "image")) meta.image = p["url"] as string;
          }
        }
      }
    } catch { /* Reddit JSON failed */ }

    if (!meta.title || !meta.description || !meta.image) {
      attempts["redditJina"] = { attempted: true, ok: false };
      try {
        const jinaUrl = `https://r.jina.ai/${targetUrl.toString()}`;
        const proxied = await fetchTextWithTimeout(jinaUrl, headers, 10000);
        (attempts["redditJina"] as Record<string, unknown>)["ok"] = proxied.ok;
        const redditMeta = extractMetadata(proxied.text);
        if (!meta.title && redditMeta.title) meta.title = redditMeta.title;
        if (!meta.description && redditMeta.description) meta.description = redditMeta.description;
        if (!meta.image && redditMeta.image) meta.image = redditMeta.image;
      } catch { /* ignore */ }
    }
  }

  // Threads
  const isThreads = targetUrl.hostname.includes("threads.com") || targetUrl.hostname.includes("threads.net");
  if (isThreads && (!meta.title || !meta.description || !meta.image)) {
    attempts["threadsJina"] = { attempted: true, ok: false };
    try {
      const threadsHeaders: Record<string, string> = {
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      };
      const threadsRes = await fetchTextWithTimeout(targetUrl.toString(), threadsHeaders, 10000);
      (attempts["threadsJina"] as Record<string, unknown>)["ok"] = threadsRes.ok;
      if (threadsRes.ok) {
        const threadsMeta = extractMetadata(threadsRes.text);
        if (threadsMeta.title && threadsMeta.title !== "403") meta.title = threadsMeta.title;
        if (threadsMeta.description) meta.description = threadsMeta.description;
        if (threadsMeta.image) meta.image = threadsMeta.image;
      }
    } catch { /* ignore */ }
  }

  const image = meta.image ? new URL(meta.image, finalUrl).toString() : undefined;
  const proxiedImage = (() => {
    if (!image) return undefined;
    try {
      const host = new URL(image).hostname;
      return shouldProxyImageHost(host) ? `/api/proxy-image?url=${encodeURIComponent(image)}` : image;
    } catch { return image; }
  })();

  res.status(200).setHeader("Cache-Control", "no-store").json({
    url: finalUrl, contentType, status: primary.status,
    title: meta.title, description: meta.description, image: proxiedImage,
    ...(debug ? { debug: { isInstagram, attempts, extracted: { hasTitle: !!meta.title, hasDescription: !!meta.description, hasImage: !!meta.image } } } : {}),
  });
}

// ---------------------------------------------------------------------------
// Exported Cloud Function
// ---------------------------------------------------------------------------

export const api = functions
  .runWith({ timeoutSeconds: 30, memory: "256MB", secrets: ["FB_APP_ID", "FB_APP_SECRET"] })
  .https.onRequest(async (req, res) => {
    await handleRequest(req, res, FB_APP_ID.value(), FB_APP_SECRET.value());
  });
