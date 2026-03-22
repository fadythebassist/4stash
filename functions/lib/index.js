"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const functions = __importStar(require("firebase-functions"));
const params_1 = require("firebase-functions/params");
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const url_1 = require("url");
const FB_APP_ID = (0, params_1.defineSecret)("FB_APP_ID");
const FB_APP_SECRET = (0, params_1.defineSecret)("FB_APP_SECRET");
const THREADS_APP_SECRET = (0, params_1.defineSecret)("THREADS_APP_SECRET");
// ---------------------------------------------------------------------------
// Helpers (ported from vite.config.ts unfurl middleware)
// ---------------------------------------------------------------------------
function decodeHtmlEntities(input) {
    return input
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ");
}
function extractMetadata(html) {
    var _a;
    const metas = (_a = html.match(/<meta\s+[^>]*>/gi)) !== null && _a !== void 0 ? _a : [];
    const map = new Map();
    for (const tag of metas) {
        const keyMatch = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i);
        const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
        if (!keyMatch || !contentMatch)
            continue;
        const key = keyMatch[1].trim().toLowerCase();
        const content = decodeHtmlEntities(contentMatch[1].trim());
        if (!map.has(key) && content)
            map.set(key, content);
    }
    const titleFromOg = map.get("og:title") || map.get("twitter:title");
    const descriptionFromOg = map.get("og:description") ||
        map.get("twitter:description") ||
        map.get("description");
    const imageFromOg = map.get("og:image:secure_url") ||
        map.get("og:image:url") ||
        map.get("og:image") ||
        map.get("twitter:image");
    let title = titleFromOg;
    if (!title) {
        const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        if (titleTag === null || titleTag === void 0 ? void 0 : titleTag[1])
            title = decodeHtmlEntities(titleTag[1].trim());
    }
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
    const description = descriptionFromOg || map.get("og:description") || map.get("twitter:description") || map.get("description");
    const image = imageFromOg || map.get("og:image:secure_url") || map.get("og:image:url") || map.get("og:image") || map.get("twitter:image");
    return { title, description, image };
}
function isGenericInstagramTitle(title) {
    if (!title)
        return true;
    const t = title.trim().toLowerCase();
    if (t === "instagram")
        return true;
    if (t.includes("403") || t.includes("forbidden") || t.includes("access denied"))
        return true;
    if (t.includes("not available"))
        return true;
    if (t.includes("log in") || t.includes("login") || t.includes("sign up"))
        return true;
    if (t === "instagram • photos and videos")
        return true;
    return false;
}
function cleanInstagramText(input) {
    if (!input)
        return undefined;
    let t = decodeHtmlEntities(input).replace(/\s+/g, " ").trim();
    if (!t)
        return undefined;
    t = t.replace(/^\d+\s+Likes,\s+\d+\s+Comments\s+-\s+/i, "").trim();
    t = t.replace(/^\d+\s+likes,\s+\d+\s+comments\s+-\s+/i, "").trim();
    return t || undefined;
}
function isGenericInstagramDescription(desc) {
    const d = (desc !== null && desc !== void 0 ? desc : "").trim().toLowerCase();
    if (!d)
        return true;
    if (d.includes("log in") || d.includes("login") || d.includes("sign up"))
        return true;
    if (d.includes("instagram"))
        return false;
    return false;
}
function isGenericRedditTitle(title) {
    if (!title)
        return true;
    const t = title.trim().toLowerCase();
    if (t === "403" || t === "error" || t === "forbidden" || t === "reddit")
        return true;
    if (t === "reddit - the heart of the internet")
        return true;
    if (t === "reddit \u2013 the heart of the internet")
        return true;
    if (t.includes("403") || t.includes("forbidden") || t.includes("access denied"))
        return true;
    if (t.includes("log in") || t.includes("login") || t.includes("sign up"))
        return true;
    if (t.includes("not found") || t.includes("unavailable") || t.includes("not available"))
        return true;
    if (t.includes("something went wrong"))
        return true;
    if (t.includes("whoa there"))
        return true;
    return false;
}
function isGenericFacebookTitle(title) {
    if (!title)
        return true;
    const t = title.trim().toLowerCase();
    if (t === "403" || t === "error" || t === "error facebook" || t === "facebook")
        return true;
    if (t.includes("403") || t.includes("forbidden") || t.includes("access denied"))
        return true;
    if (t.includes("log in") || t.includes("login") || t.includes("sign up"))
        return true;
    if (t.includes("not available") || t.includes("content not found"))
        return true;
    if (t.includes("something went wrong"))
        return true;
    return false;
}
function shouldProxyImageHost(hostname) {
    const h = hostname.toLowerCase();
    return ((h.includes("instagram.com") && !h.includes("cdninstagram.com")) ||
        h.endsWith("fbcdn.net") ||
        h.includes("facebook.com") ||
        h.endsWith("fbsbx.com"));
}
function isFacebookShareLike(url) {
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    if (!host.includes("facebook.com") && !host.includes("fb.watch"))
        return false;
    if (path.startsWith("/sharer/sharer.php"))
        return true;
    if (path.startsWith("/share.php"))
        return true;
    if (path.includes("/share/"))
        return true;
    if (host.includes("fb.watch"))
        return true;
    if (path.includes("/permalink.php"))
        return true;
    return false;
}
function extractFacebookSharedTarget(url) {
    const uParam = url.searchParams.get("u") || url.searchParams.get("url");
    if (!uParam)
        return null;
    try {
        return new url_1.URL(uParam);
    }
    catch (_a) {
        return null;
    }
}
// Node.js-native HTTP fetch (Cloud Functions don't have the browser fetch API in Node 18-,
// but Node 20 does. We use the built-in fetch if available, otherwise fall back to http/https.)
async function nodeFetch(urlStr, opts = {}) {
    var _a, _b;
    // Node 20 has globalThis.fetch — use it when available
    if (typeof globalThis.fetch === "function") {
        const controller = new AbortController();
        const tid = opts.timeoutMs ? setTimeout(() => controller.abort(), opts.timeoutMs) : null;
        try {
            const res = await globalThis.fetch(urlStr, {
                method: (_a = opts.method) !== null && _a !== void 0 ? _a : "GET",
                headers: opts.headers,
                redirect: (_b = opts.redirect) !== null && _b !== void 0 ? _b : "follow",
                signal: controller.signal,
            });
            if (tid)
                clearTimeout(tid);
            const headersMap = new Map();
            res.headers.forEach((v, k) => headersMap.set(k.toLowerCase(), v));
            return {
                ok: res.ok,
                status: res.status,
                finalUrl: res.url || urlStr,
                text: () => res.text(),
                arrayBuffer: () => res.arrayBuffer(),
                headers: headersMap,
            };
        }
        catch (e) {
            if (tid)
                clearTimeout(tid);
            throw e;
        }
    }
    // Fallback: Node http/https
    return new Promise((resolve, reject) => {
        var _a, _b;
        const parsedUrl = new url_1.URL(urlStr);
        const lib = parsedUrl.protocol === "https:" ? https : http;
        const reqOpts = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: (_a = opts.method) !== null && _a !== void 0 ? _a : "GET",
            headers: (_b = opts.headers) !== null && _b !== void 0 ? _b : {},
        };
        let timeoutId = null;
        const req = lib.request(reqOpts, (res) => {
            if (timeoutId)
                clearTimeout(timeoutId);
            const finalUrl = res.headers.location || urlStr;
            const headersMap = new Map();
            for (const [k, v] of Object.entries(res.headers)) {
                if (v)
                    headersMap.set(k.toLowerCase(), Array.isArray(v) ? v[0] : v);
            }
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
                var _a, _b, _c;
                const buf = Buffer.concat(chunks);
                resolve({
                    ok: ((_a = res.statusCode) !== null && _a !== void 0 ? _a : 0) >= 200 && ((_b = res.statusCode) !== null && _b !== void 0 ? _b : 0) < 300,
                    status: (_c = res.statusCode) !== null && _c !== void 0 ? _c : 0,
                    finalUrl,
                    text: async () => buf.toString("utf8"),
                    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
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
async function fetchTextWithTimeout(url, headers, timeoutMs) {
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
function isFacebookLoginUrl(url) {
    try {
        const u = new url_1.URL(url);
        return u.hostname.includes("facebook.com") && (u.pathname.startsWith("/login") ||
            u.pathname.startsWith("/checkpoint") ||
            u.pathname.startsWith("/recover"));
    }
    catch (_a) {
        return false;
    }
}
/**
 * When Facebook redirects us to a login wall, the real destination post URL is
 * encoded in the `next` query parameter of the login URL.
 * Extract it and convert it to a usable embed permalink:
 *   /permalink.php?story_fbid=<fbid>&id=<page_id>  →  /<page_id>/posts/<fbid>/
 */
function extractPermalinkFromLoginRedirect(loginUrl) {
    try {
        const u = new url_1.URL(loginUrl);
        if (!isFacebookLoginUrl(loginUrl))
            return null;
        const next = u.searchParams.get("next");
        if (!next)
            return null;
        const nextUrl = new url_1.URL(next);
        if (!nextUrl.hostname.includes("facebook.com"))
            return null;
        // Case 1: /permalink.php?story_fbid=X&id=Y  →  /Y/posts/X/
        if (nextUrl.pathname.toLowerCase().includes("/permalink.php")) {
            const storyFbid = nextUrl.searchParams.get("story_fbid");
            const id = nextUrl.searchParams.get("id");
            if (storyFbid && id) {
                return `https://www.facebook.com/${id}/posts/${storyFbid}/`;
            }
        }
        // Case 2: the next URL itself is already a usable permalink (not a /share/ or /login/)
        if (!nextUrl.pathname.includes("/share/") && !isFacebookLoginUrl(next)) {
            // Strip tracking params before returning
            nextUrl.searchParams.delete("rdid");
            nextUrl.searchParams.delete("share_url");
            return nextUrl.toString();
        }
    }
    catch ( /* ignore */_a) { /* ignore */ }
    return null;
}
async function resolveFacebookShareUrl(targetUrl, headers, timeoutMs) {
    const host = targetUrl.hostname.toLowerCase();
    const path = targetUrl.pathname.toLowerCase();
    if (host.includes("fb.watch")) {
        try {
            const res = await nodeFetch(targetUrl.toString(), { headers, timeoutMs, redirect: "follow" });
            const finalUrl = res.finalUrl && res.finalUrl !== targetUrl.toString() ? res.finalUrl : null;
            if (finalUrl && !isFacebookLoginUrl(finalUrl))
                return finalUrl;
            if (finalUrl && isFacebookLoginUrl(finalUrl)) {
                return extractPermalinkFromLoginRedirect(finalUrl);
            }
        }
        catch ( /* ignore */_a) { /* ignore */ }
        return null;
    }
    if (!host.includes("facebook.com") || !path.includes("/share/"))
        return null;
    try {
        const res = await nodeFetch(targetUrl.toString(), { headers, timeoutMs, redirect: "follow" });
        const finalUrl = res.finalUrl && res.finalUrl !== targetUrl.toString() ? res.finalUrl : null;
        // Happy path: resolved to a non-share, non-login URL
        if (finalUrl && !finalUrl.includes("/share/") && !isFacebookLoginUrl(finalUrl))
            return finalUrl;
        // Login wall: extract the real destination from the `next` param
        if (finalUrl && isFacebookLoginUrl(finalUrl)) {
            const extracted = extractPermalinkFromLoginRedirect(finalUrl);
            if (extracted)
                return extracted;
            // Don't fall through to HTML parsing — we're on a login page, not the target
            return null;
        }
        // Still on a share URL or no redirect — try HTML parsing
        const text = await res.text();
        const ogUrl = text.match(/<meta\s+[^>]*property\s*=\s*["']og:url["'][^>]*content\s*=\s*["']([^"']+)["']/i);
        if ((ogUrl === null || ogUrl === void 0 ? void 0 : ogUrl[1]) && !ogUrl[1].includes("/share/")) {
            try {
                const resolved = new url_1.URL(ogUrl[1], targetUrl.toString()).toString();
                if (!isFacebookLoginUrl(resolved))
                    return resolved;
                const extracted = extractPermalinkFromLoginRedirect(resolved);
                if (extracted)
                    return extracted;
            }
            catch ( /* ignore */_b) { /* ignore */ }
        }
        const canonical = text.match(/<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["']/i);
        if ((canonical === null || canonical === void 0 ? void 0 : canonical[1]) && !canonical[1].includes("/share/")) {
            try {
                const resolved = new url_1.URL(canonical[1], targetUrl.toString()).toString();
                if (!isFacebookLoginUrl(resolved))
                    return resolved;
            }
            catch ( /* ignore */_c) { /* ignore */ }
        }
        const jsRedirect = text.match(/window\.location\s*=\s*["']([^"']+)["']/i) || text.match(/location\.href\s*=\s*["']([^"']+)["']/i) || text.match(/"redirect_url"\s*:\s*"([^"]+)"/i);
        if ((jsRedirect === null || jsRedirect === void 0 ? void 0 : jsRedirect[1]) && !jsRedirect[1].includes("/share/")) {
            try {
                const decoded = jsRedirect[1].replace(/\\u002F/g, "/").replace(/\\\//g, "/");
                const resolved = new url_1.URL(decoded, targetUrl.toString()).toString();
                if (!isFacebookLoginUrl(resolved))
                    return resolved;
            }
            catch ( /* ignore */_d) { /* ignore */ }
        }
    }
    catch (_e) {
        return null;
    }
    return null;
}
async function resolveRedditShortUrl(targetUrl, headers, timeoutMs) {
    const isShort = /\/s\/[a-zA-Z0-9]+/.test(targetUrl.pathname);
    if (!isShort)
        return null;
    const tryManual = async (method) => {
        try {
            const res = await nodeFetch(targetUrl.toString(), {
                method,
                headers,
                timeoutMs,
                redirect: "manual",
            });
            const location = res.headers.get("location");
            if (!location)
                return null;
            return new url_1.URL(location, targetUrl.toString()).toString();
        }
        catch (_a) {
            return null;
        }
    };
    const fromHead = await tryManual("HEAD");
    if (fromHead)
        return fromHead;
    const fromGet = await tryManual("GET");
    if (fromGet)
        return fromGet;
    return null;
}
function tryParseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch (_a) {
        return null;
    }
}
function* walkJson(node) {
    if (node === null || node === undefined)
        return;
    yield node;
    if (Array.isArray(node)) {
        for (const v of node)
            yield* walkJson(v);
    }
    else if (typeof node === "object") {
        for (const v of Object.values(node))
            yield* walkJson(v);
    }
}
function extractInstagramCaptionFromJsonLd(html) {
    var _a;
    const blocks = (_a = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)) !== null && _a !== void 0 ? _a : [];
    for (const block of blocks) {
        const m = block.match(/>\s*([\s\S]*?)\s*<\/script>/i);
        if (!(m === null || m === void 0 ? void 0 : m[1]))
            continue;
        const parsed = tryParseJson(m[1].trim());
        if (!parsed)
            continue;
        for (const node of walkJson(parsed)) {
            if (!node || typeof node !== "object")
                continue;
            const obj = node;
            const candidates = [obj["caption"], obj["articleBody"], obj["description"], obj["text"], obj["headline"], obj["name"]].filter((v) => typeof v === "string");
            for (const c of candidates) {
                const cleaned = cleanInstagramText(c);
                if (cleaned && cleaned.length >= 5)
                    return cleaned;
            }
        }
    }
    return undefined;
}
function extractInstagramCaptionFromHtml(html) {
    const patterns = [
        /"caption"\s*:\s*\{[^}]*"text"\s*:\s*"([^"]+)"/i,
        /"edge_media_to_caption"\s*:\s*\{[\s\S]*?"text"\s*:\s*"([^"]+)"/i,
        /"accessibility_caption"\s*:\s*"([^"]+)"/i,
    ];
    for (const re of patterns) {
        const m = html.match(re);
        if (m === null || m === void 0 ? void 0 : m[1]) {
            const unescaped = m[1].replace(/\\n/g, " ").replace(/\\u003c/g, "<").replace(/\\u003e/g, ">");
            const cleaned = cleanInstagramText(unescaped);
            if (cleaned && cleaned.length >= 5)
                return cleaned;
        }
    }
    return undefined;
}
async function tryInstagramJson(targetUrl) {
    var _a, _b, _c, _d;
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
        if (!res.ok)
            return null;
        const data = tryParseJson(await res.text());
        if (!data)
            return null;
        const graphql = data["graphql"];
        const items = data["items"];
        const media = ((_a = graphql === null || graphql === void 0 ? void 0 : graphql["shortcode_media"]) !== null && _a !== void 0 ? _a : items === null || items === void 0 ? void 0 : items[0]);
        if (!media)
            return null;
        const edgeCaption = media["edge_media_to_caption"];
        const edges = edgeCaption === null || edgeCaption === void 0 ? void 0 : edgeCaption["edges"];
        const firstEdge = edges === null || edges === void 0 ? void 0 : edges[0];
        const firstNode = firstEdge === null || firstEdge === void 0 ? void 0 : firstEdge["node"];
        const captionObj = media["caption"];
        const captionText = (_b = firstNode === null || firstNode === void 0 ? void 0 : firstNode["text"]) !== null && _b !== void 0 ? _b : captionObj === null || captionObj === void 0 ? void 0 : captionObj["text"];
        const imageUrl = (_c = media["display_url"]) !== null && _c !== void 0 ? _c : (_d = media["image_versions2"]) === null || _d === void 0 ? void 0 : _d["candidates"];
        return {
            description: typeof captionText === "string" ? captionText : undefined,
            image: typeof imageUrl === "string" ? imageUrl : undefined,
        };
    }
    catch (_e) {
        return null;
    }
}
function buildInstagramMediaFallbackUrl(u) {
    const m = u.pathname.match(/\/(p|reel|tv)\/([^/?#]+)/i);
    if (!(m === null || m === void 0 ? void 0 : m[1]) || !(m === null || m === void 0 ? void 0 : m[2]))
        return null;
    return `https://www.instagram.com/p/${m[2]}/media/?size=l`;
}
// ---------------------------------------------------------------------------
// Main handler (shared between /api/unfurl and /api/proxy-image)
// ---------------------------------------------------------------------------
async function handleRequest(req, res, fbAppId, fbAppSecret, threadsAppSecret) {
    var _a, _b, _c, _d, _e;
    // CORS — allow 4later.xyz and localhost dev
    const origin = req.headers["origin"];
    const allowedOrigins = ["https://4later.xyz", "https://later-production-9a596.web.app", "http://localhost:5173", "http://localhost:4173"];
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }
    else {
        res.setHeader("Access-Control-Allow-Origin", "https://4later.xyz");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    const path = req.path;
    // POST routes
    if (req.method === "POST") {
        // -------------------------------------------------------------------------
        // /api/threads-token  — server-side Threads OAuth code exchange
        // Keeps the app secret out of the client bundle.
        // -------------------------------------------------------------------------
        if (path === "/threads-token" || path === "/api/threads-token") {
            const { code, redirectUri, appId } = req.body;
            if (!code || !redirectUri || !appId) {
                res.status(400).json({ error: "Missing required fields: code, redirectUri, appId" });
                return;
            }
            if (!threadsAppSecret) {
                res.status(500).json({ error: "Threads app secret not configured" });
                return;
            }
            try {
                const params = new URLSearchParams({
                    client_id: appId,
                    client_secret: threadsAppSecret,
                    grant_type: "authorization_code",
                    redirect_uri: redirectUri,
                    code,
                });
                const controller = new AbortController();
                const tid = setTimeout(() => controller.abort(), 10000);
                const response = await globalThis.fetch("https://graph.threads.net/oauth/access_token", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json" },
                    body: params.toString(),
                    signal: controller.signal,
                });
                clearTimeout(tid);
                const data = await response.json();
                if (!response.ok) {
                    res.status(400).json({ error: (_b = (_a = data["error_message"]) !== null && _a !== void 0 ? _a : data["error"]) !== null && _b !== void 0 ? _b : "Token exchange failed" });
                    return;
                }
                res.status(200).json(data);
            }
            catch (e) {
                res.status(500).json({ error: e instanceof Error ? e.message : "Token exchange failed" });
            }
            return;
        }
        res.status(404).json({ error: "Not found" });
        return;
    }
    // -------------------------------------------------------------------------
    // /api/proxy-image
    // -------------------------------------------------------------------------
    if (path === "/proxy-image" || path === "/api/proxy-image") {
        const target = req.query["url"];
        if (!target) {
            res.status(400).json({ error: "Missing url param" });
            return;
        }
        let targetUrl;
        try {
            targetUrl = new url_1.URL(target);
        }
        catch (_f) {
            res.status(400).json({ error: "Invalid url param" });
            return;
        }
        if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
            res.status(400).json({ error: "Only http/https URLs are allowed" });
            return;
        }
        const h = targetUrl.hostname.toLowerCase();
        const isFbImg = h.endsWith("fbsbx.com") || h.endsWith("fbcdn.net") || h.includes("facebook.com");
        const isIgImg = h.includes("cdninstagram.com") || h.includes("instagram.com");
        const imgHeaders = Object.assign(Object.assign({ "user-agent": isFbImg
                ? "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
                : isIgImg
                    ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
                    : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8", "accept-language": "en-US,en;q=0.9" }, (isFbImg ? { referer: "https://www.facebook.com/" } : {})), (isIgImg ? { referer: "https://www.instagram.com/" } : {}));
        try {
            const upstream = await nodeFetch(targetUrl.toString(), { headers: imgHeaders, timeoutMs: 10000 });
            const contentType = upstream.headers.get("content-type") || "";
            if (!upstream.ok || !contentType.toLowerCase().startsWith("image/")) {
                res.status(422).json({ error: "Upstream did not return an image", status: upstream.status, contentType });
                return;
            }
            const buf = Buffer.from(await upstream.arrayBuffer());
            if (buf.byteLength > 8 * 1024 * 1024) {
                res.status(413).json({ error: "Image too large" });
                return;
            }
            res.status(200).setHeader("Content-Type", contentType).setHeader("Cache-Control", "no-store").end(buf);
        }
        catch (e) {
            res.status(500).json({ error: e instanceof Error && e.message === "Timeout" ? "Upstream timeout" : "Proxy failed" });
        }
        return;
    }
    // -------------------------------------------------------------------------
    // /api/threads-token  — server-side Threads OAuth code exchange
    // Keeps the app secret out of the client bundle.
    // -------------------------------------------------------------------------
    if (path === "/threads-token" || path === "/api/threads-token") {
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        const { code, redirectUri, appId } = req.body;
        if (!code || !redirectUri || !appId) {
            res.status(400).json({ error: "Missing required fields: code, redirectUri, appId" });
            return;
        }
        if (!threadsAppSecret) {
            res.status(500).json({ error: "Threads app secret not configured" });
            return;
        }
        try {
            const params = new URLSearchParams({
                client_id: appId,
                client_secret: threadsAppSecret,
                grant_type: "authorization_code",
                redirect_uri: redirectUri,
                code,
            });
            const tokenRes = await nodeFetch("https://graph.threads.net/oauth/access_token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json" },
                timeoutMs: 10000,
            });
            // nodeFetch doesn't support body for POST yet — use globalThis.fetch directly
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 10000);
            const response = await globalThis.fetch("https://graph.threads.net/oauth/access_token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json" },
                body: params.toString(),
                signal: controller.signal,
            });
            clearTimeout(tid);
            // suppress unused variable — nodeFetch call above was replaced
            void tokenRes;
            const data = await response.json();
            if (!response.ok) {
                res.status(400).json({ error: (_d = (_c = data["error_message"]) !== null && _c !== void 0 ? _c : data["error"]) !== null && _d !== void 0 ? _d : "Token exchange failed" });
                return;
            }
            res.status(200).json(data);
        }
        catch (e) {
            res.status(500).json({ error: e instanceof Error ? e.message : "Token exchange failed" });
        }
        return;
    }
    // -------------------------------------------------------------------------
    // /api/unfurl
    // -------------------------------------------------------------------------
    if (path !== "/unfurl" && path !== "/api/unfurl") {
        res.status(404).json({ error: "Not found" });
        return;
    }
    const target = req.query["url"];
    const debug = req.query["debug"] === "1";
    if (!target) {
        res.status(400).json({ error: "Missing url param" });
        return;
    }
    let targetUrl;
    try {
        targetUrl = new url_1.URL(target);
    }
    catch (_g) {
        res.status(400).json({ error: "Invalid url param" });
        return;
    }
    if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
        res.status(400).json({ error: "Only http/https URLs are allowed" });
        return;
    }
    const headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
    };
    const facebookPreviewHeaders = Object.assign(Object.assign({}, headers), { "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" });
    const isFacebook = targetUrl.hostname.includes("facebook.com") || targetUrl.hostname.includes("fb.watch");
    const isFacebookShare = isFacebook && isFacebookShareLike(targetUrl);
    // Keep a copy of the original share URL so we can return it if resolution fails / hits a login wall
    const originalShareUrl = isFacebookShare ? targetUrl.toString() : null;
    let shareResolvedUrl = null;
    if (isFacebookShare) {
        const extracted = extractFacebookSharedTarget(targetUrl);
        if (extracted) {
            shareResolvedUrl = extracted.toString();
            targetUrl = extracted;
        }
        else {
            const resolved = await resolveFacebookShareUrl(targetUrl, facebookPreviewHeaders, 10000);
            if (resolved) {
                shareResolvedUrl = resolved;
                try {
                    targetUrl = new url_1.URL(resolved);
                }
                catch ( /* keep original */_h) { /* keep original */ }
            }
        }
    }
    // If after resolution we ended up on a login/checkpoint page, bail out early.
    // Return the original share URL so the client keeps the short URL (which isFacebookShortShareUrl() handles).
    if (isFacebook && isFacebookLoginUrl(targetUrl.toString())) {
        res.status(200).setHeader("Cache-Control", "no-store").json(Object.assign({ url: originalShareUrl !== null && originalShareUrl !== void 0 ? originalShareUrl : targetUrl.toString(), contentType: "", status: 0, title: undefined, description: undefined, image: undefined, shareResolvedUrl: null }, (debug ? { debug: { loginWall: true } } : {})));
        return;
    }
    const primary = await fetchTextWithTimeout(targetUrl.toString(), isFacebookShare ? facebookPreviewHeaders : headers, 10000);
    let finalUrl = primary.finalUrl;
    const contentType = primary.contentType;
    const meta = extractMetadata(primary.text);
    const attempts = {
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
        }
        else {
            meta.description = cleanInstagramText(meta.description) || meta.description;
        }
        attempts["instagramJson"] = { attempted: true, ok: false };
        const ig = await tryInstagramJson(targetUrl);
        attempts["instagramJson"]["ok"] = !!ig;
        if ((ig === null || ig === void 0 ? void 0 : ig.description) && (!meta.description || isGenericInstagramDescription(meta.description))) {
            meta.description = cleanInstagramText(ig.description) || ig.description;
        }
        if ((ig === null || ig === void 0 ? void 0 : ig.image) && !meta.image)
            meta.image = ig.image;
        if (isGenericInstagramTitle(meta.title))
            meta.title = undefined;
        if (!meta.image || !meta.description) {
            const jinaUrl = `https://r.jina.ai/${targetUrl.toString()}`;
            attempts["jina"] = { attempted: true, ok: false };
            const proxied = await fetchTextWithTimeout(jinaUrl, headers, 10000);
            attempts["jina"]["ok"] = proxied.ok;
            const proxyMeta = extractMetadata(proxied.text);
            if (!meta.title && proxyMeta.title && !isGenericInstagramTitle(proxyMeta.title))
                meta.title = proxyMeta.title;
            if (!meta.description && proxyMeta.description)
                meta.description = cleanInstagramText(proxyMeta.description) || proxyMeta.description;
            if (!meta.image && proxyMeta.image)
                meta.image = proxyMeta.image;
            if (!meta.description) {
                const proxyLd = extractInstagramCaptionFromJsonLd(proxied.text);
                const proxyHtml = extractInstagramCaptionFromHtml(proxied.text);
                meta.description = cleanInstagramText(proxyLd || proxyHtml) || meta.description;
            }
        }
        if (!meta.image) {
            attempts["fallbackMediaUrl"] = { attempted: true, used: false };
            const fallback = buildInstagramMediaFallbackUrl(targetUrl);
            if (fallback) {
                meta.image = fallback;
                attempts["fallbackMediaUrl"]["used"] = true;
            }
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
            const mbasicUrl = new url_1.URL(targetUrl.toString());
            mbasicUrl.hostname = "mbasic.facebook.com";
            const mbasicRes = await fetchTextWithTimeout(mbasicUrl.toString(), facebookPreviewHeaders, 8000);
            if (mbasicRes.ok) {
                const mbasicMeta = extractMetadata(mbasicRes.text);
                if (mbasicMeta.image)
                    meta.image = mbasicMeta.image;
                if (!meta.title && mbasicMeta.title && !isGenericFacebookTitle(mbasicMeta.title))
                    meta.title = mbasicMeta.title;
                if (!meta.description && mbasicMeta.description)
                    meta.description = mbasicMeta.description;
                if (!meta.image) {
                    const imgMatches = (_e = mbasicRes.text.match(/<img\s[^>]*src=["']([^"']+)["'][^>]*>/gi)) !== null && _e !== void 0 ? _e : [];
                    for (const imgTag of imgMatches) {
                        const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
                        if (!(srcMatch === null || srcMatch === void 0 ? void 0 : srcMatch[1]))
                            continue;
                        const src = srcMatch[1];
                        if (src.includes("static.xx.fbcdn") || src.includes("emoji") || src.includes("reaction") || src.includes("rsrc.php"))
                            continue;
                        if (src.startsWith("https://")) {
                            meta.image = src;
                            break;
                        }
                    }
                }
            }
        }
        catch ( /* mbasic failed */_j) { /* mbasic failed */ }
    }
    // Facebook oEmbed + Jina fallback
    if (isFacebookHost && (!meta.title || !meta.description || !meta.image)) {
        // Secrets set via: firebase functions:secrets:set FB_APP_ID and FB_APP_SECRET
        const appId = fbAppId;
        const appSecret = fbAppSecret;
        if (appId && appSecret) {
            attempts["facebookOembed"] = { attempted: true, ok: false };
            try {
                const accessToken = `${appId}|${appSecret}`;
                const oembedUrl = `https://graph.facebook.com/v19.0/oembed_post?url=${encodeURIComponent(targetUrl.toString())}&access_token=${encodeURIComponent(accessToken)}&fields=author_name,author_url,provider_name,provider_url,type,width,height,html`;
                const oembedRes = await nodeFetch(oembedUrl, { headers: { accept: "application/json" }, timeoutMs: 8000 });
                if (oembedRes.ok) {
                    const oembedData = tryParseJson(await oembedRes.text());
                    if (oembedData) {
                        attempts["facebookOembed"]["ok"] = true;
                        if (!meta.title && oembedData["author_name"])
                            meta.title = decodeHtmlEntities(oembedData["author_name"]);
                        else if (!meta.title && oembedData["html"]) {
                            const textMatch = oembedData["html"].match(/>([^<]+)</);
                            if (textMatch === null || textMatch === void 0 ? void 0 : textMatch[1])
                                meta.title = decodeHtmlEntities(textMatch[1].trim());
                        }
                        if (!meta.description && oembedData["html"]) {
                            const descText = oembedData["html"]
                                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                                .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
                            if (descText)
                                meta.description = decodeHtmlEntities(descText);
                        }
                    }
                }
            }
            catch ( /* ignore oEmbed errors */_k) { /* ignore oEmbed errors */ }
        }
        if (!meta.title || !meta.description || !meta.image) {
            attempts["facebookJina"] = { attempted: true, ok: false };
            try {
                const jinaUrl = `https://r.jina.ai/${targetUrl.toString()}`;
                const proxied = await fetchTextWithTimeout(jinaUrl, headers, 10000);
                attempts["facebookJina"]["ok"] = proxied.ok;
                const fbMeta = extractMetadata(proxied.text);
                if (!meta.title && fbMeta.title && !isGenericFacebookTitle(fbMeta.title))
                    meta.title = fbMeta.title;
                if (!meta.description && fbMeta.description)
                    meta.description = fbMeta.description;
                if (!meta.image && fbMeta.image)
                    meta.image = fbMeta.image;
            }
            catch ( /* ignore */_l) { /* ignore */ }
        }
    }
    // Early return if Facebook still has nothing
    if (isFacebookHost && !meta.title && !meta.description && !meta.image) {
        res.status(200).setHeader("Cache-Control", "no-store").json(Object.assign({ url: targetUrl.toString(), contentType, status: primary.status, title: undefined, description: undefined, image: undefined, shareResolvedUrl }, (debug ? { debug: { attempts } } : {})));
        return;
    }
    // Reddit
    const isReddit = targetUrl.hostname.includes("reddit.com") || targetUrl.hostname.includes("redd.it");
    if (isReddit) {
        // Resolve Reddit /s/CODE mobile share URLs before trying .json.
        const redditResolved = await resolveRedditShortUrl(targetUrl, headers, 8000);
        if (redditResolved) {
            try {
                const resolvedUrl = new url_1.URL(redditResolved);
                targetUrl = resolvedUrl;
                finalUrl = resolvedUrl.toString();
            }
            catch (_m) {
                // keep original targetUrl
            }
        }
        attempts["redditJson"] = { attempted: true, ok: false };
        try {
            const redditJsonUrl = new url_1.URL(targetUrl.toString());
            redditJsonUrl.search = "";
            redditJsonUrl.hash = "";
            if (!redditJsonUrl.pathname.endsWith("/"))
                redditJsonUrl.pathname += "/";
            const jsonUrl = redditJsonUrl.toString() + ".json";
            const redditHeaders = Object.assign(Object.assign({}, headers), { "user-agent": "Mozilla/5.0 (compatible; 4Later/1.0; +https://4later.app)" });
            const jsonRes = await fetchTextWithTimeout(jsonUrl, redditHeaders, 8000);
            attempts["redditJson"]["ok"] = jsonRes.ok;
            if (jsonRes.ok) {
                const data = tryParseJson(jsonRes.text);
                const post = data === null || data === void 0 ? void 0 : data[0];
                const postData = post === null || post === void 0 ? void 0 : post["data"];
                const children = postData === null || postData === void 0 ? void 0 : postData["children"];
                const firstChild = children === null || children === void 0 ? void 0 : children[0];
                const p = firstChild === null || firstChild === void 0 ? void 0 : firstChild["data"];
                if (p) {
                    if (p["over_18"] === true || p["over18"] === true) {
                        const nsfwTitle = p["title"] ? decodeHtmlEntities(p["title"]) : "NSFW Reddit Post";
                        res.status(200).setHeader("Cache-Control", "no-store").json(Object.assign({ url: targetUrl.toString(), contentType, status: primary.status, title: nsfwTitle, description: "This Reddit post is marked as NSFW (18+)", image: undefined, nsfw: true }, (debug ? { debug: { attempts } } : {})));
                        return;
                    }
                    if (!meta.title && p["title"])
                        meta.title = decodeHtmlEntities(p["title"]);
                    if (!meta.description && p["selftext"])
                        meta.description = decodeHtmlEntities(p["selftext"].replace(/\n+/g, " ").trim().substring(0, 300));
                    if (!meta.image) {
                        const preview = p["preview"];
                        const images = preview === null || preview === void 0 ? void 0 : preview["images"];
                        const firstImg = images === null || images === void 0 ? void 0 : images[0];
                        const source = firstImg === null || firstImg === void 0 ? void 0 : firstImg["source"];
                        if (source === null || source === void 0 ? void 0 : source["url"])
                            meta.image = decodeHtmlEntities(source["url"]).replace(/&amp;/g, "&");
                        else if (p["thumbnail"] && p["thumbnail"].startsWith("http"))
                            meta.image = p["thumbnail"];
                        else if (p["url"] && (p["url"].match(/\.(jpg|jpeg|png|gif|webp)$/i) || p["post_hint"] === "image"))
                            meta.image = p["url"];
                    }
                }
            }
        }
        catch ( /* Reddit JSON failed */_o) { /* Reddit JSON failed */ }
        // Reddit oEmbed — works server-side and returns the real post title.
        // Try this before Jina since it's more reliable.
        if (!meta.title) {
            attempts["redditOembed"] = { attempted: true, ok: false };
            try {
                const oembedUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(targetUrl.toString())}`;
                const oembedRes = await fetchTextWithTimeout(oembedUrl, Object.assign(Object.assign({}, headers), { accept: "application/json" }), 8000);
                attempts["redditOembed"]["ok"] = oembedRes.ok;
                if (oembedRes.ok) {
                    const oembedData = tryParseJson(oembedRes.text);
                    if ((oembedData === null || oembedData === void 0 ? void 0 : oembedData["title"]) && typeof oembedData["title"] === "string") {
                        const t = decodeHtmlEntities(oembedData["title"]);
                        if (!isGenericRedditTitle(t))
                            meta.title = t;
                    }
                    if (!meta.title && (oembedData === null || oembedData === void 0 ? void 0 : oembedData["author_name"]) && typeof oembedData["author_name"] === "string") {
                        meta.title = `Post by u/${oembedData["author_name"]}`;
                    }
                }
            }
            catch ( /* ignore */_p) { /* ignore */ }
        }
        if (!meta.title || !meta.description || !meta.image) {
            attempts["redditJina"] = { attempted: true, ok: false };
            try {
                const jinaUrl = `https://r.jina.ai/${targetUrl.toString()}`;
                const proxied = await fetchTextWithTimeout(jinaUrl, headers, 10000);
                attempts["redditJina"]["ok"] = proxied.ok;
                const redditMeta = extractMetadata(proxied.text);
                if (!meta.title && redditMeta.title)
                    meta.title = redditMeta.title;
                if (!meta.description && redditMeta.description)
                    meta.description = redditMeta.description;
                if (!meta.image && redditMeta.image)
                    meta.image = redditMeta.image;
            }
            catch ( /* ignore */_q) { /* ignore */ }
        }
        // If title is still a generic error string (e.g. "403" from the error page HTML),
        // clear it so the client falls back to its own "Reddit Post in r/..." label.
        if (isGenericRedditTitle(meta.title))
            meta.title = undefined;
    }
    // Threads
    const isThreads = targetUrl.hostname.includes("threads.com") || targetUrl.hostname.includes("threads.net");
    if (isThreads && (!meta.title || !meta.description || !meta.image)) {
        attempts["threadsJina"] = { attempted: true, ok: false };
        try {
            const threadsHeaders = {
                "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
                accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "accept-language": "en-US,en;q=0.9",
            };
            const threadsRes = await fetchTextWithTimeout(targetUrl.toString(), threadsHeaders, 10000);
            attempts["threadsJina"]["ok"] = threadsRes.ok;
            if (threadsRes.ok) {
                const threadsMeta = extractMetadata(threadsRes.text);
                if (threadsMeta.title && threadsMeta.title !== "403")
                    meta.title = threadsMeta.title;
                if (threadsMeta.description)
                    meta.description = threadsMeta.description;
                if (threadsMeta.image)
                    meta.image = threadsMeta.image;
            }
        }
        catch ( /* ignore */_r) { /* ignore */ }
    }
    const image = meta.image ? new url_1.URL(meta.image, finalUrl).toString() : undefined;
    const proxiedImage = (() => {
        if (!image)
            return undefined;
        try {
            const host = new url_1.URL(image).hostname;
            return shouldProxyImageHost(host) ? `/api/proxy-image?url=${encodeURIComponent(image)}` : image;
        }
        catch (_a) {
            return image;
        }
    })();
    res.status(200).setHeader("Cache-Control", "no-store").json(Object.assign({ url: finalUrl, contentType, status: primary.status, title: meta.title, description: meta.description, image: proxiedImage }, (debug ? { debug: { isInstagram, attempts, extracted: { hasTitle: !!meta.title, hasDescription: !!meta.description, hasImage: !!meta.image } } } : {})));
}
// ---------------------------------------------------------------------------
// Exported Cloud Function
// ---------------------------------------------------------------------------
exports.api = functions
    .runWith({ timeoutSeconds: 30, memory: "256MB", secrets: ["FB_APP_ID", "FB_APP_SECRET", "THREADS_APP_SECRET"] })
    .https.onRequest(async (req, res) => {
    await handleRequest(req, res, FB_APP_ID.value(), FB_APP_SECRET.value(), THREADS_APP_SECRET.value());
});
//# sourceMappingURL=index.js.map