import React, { useEffect, useMemo, useRef, useState } from "react";

const REDDIT_WIDGETS_SRC = "https://embed.reddit.com/widgets.js";

let redditWidgetsPromise: Promise<void> | null = null;

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  const full = trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;
  try {
    const u = new URL(full);
    // Strip UTM and other tracking query params — Reddit's embed widget requires a
    // clean canonical URL. Share-button URLs carry utm_source, utm_medium, utm_name,
    // utm_term, utm_content etc. which prevent the widget from resolving the post.
    const TRACKING_PARAMS = [
      "utm_source", "utm_medium", "utm_name", "utm_term", "utm_content",
      "utm_campaign", "ref", "ref_source", "context", "sh",
    ];
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    // Remove trailing slash for consistency
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    return u.toString();
  } catch {
    return full;
  }
}

function loadRedditWidgets(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  if (redditWidgetsPromise) return redditWidgetsPromise;

  redditWidgetsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${REDDIT_WIDGETS_SRC}"]`,
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Reddit widgets")),
        {
          once: true,
        },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = REDDIT_WIDGETS_SRC;
    script.async = true;
    script.charset = "UTF-8";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Reddit widgets"));
    document.head.appendChild(script);
  });

  return redditWidgetsPromise;
}

export interface RedditEmbedProps {
  url: string;
}

const RedditEmbed: React.FC<RedditEmbedProps> = ({ url }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const render = async () => {
      setFailed(false);
      if (!normalizedUrl || !containerRef.current) {
        setFailed(true);
        return;
      }

      containerRef.current.innerHTML = "";

      const blockquote = document.createElement("blockquote");
      blockquote.className = "reddit-card";

      const link = document.createElement("a");
      link.href = normalizedUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "View on Reddit";

      blockquote.appendChild(link);
      containerRef.current.appendChild(blockquote);

      try {
        await loadRedditWidgets();
        if (cancelled) return;

        // The Reddit widget script processes blockquote.reddit-card elements and
        // replaces them with an iframe. If it fails silently (e.g. GCP IP blocked
        // by Reddit's embed CDN), the blockquote stays unprocessed and the card
        // appears blank. We detect this with a timeout: if after 4 s the blockquote
        // is still there (i.e. not replaced with an iframe), fall back to the link.
        timeoutId = setTimeout(() => {
          if (cancelled) return;
          const stillHasBlockquote =
            containerRef.current?.querySelector("blockquote.reddit-card");
          if (stillHasBlockquote) {
            setFailed(true);
          }
        }, 4000);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    render();

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [normalizedUrl]);

  if (failed && normalizedUrl) {
    return (
      <div className="reddit-embed" onClick={(e) => e.stopPropagation()}>
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="card-link"
          onClick={(e) => e.stopPropagation()}
        >
          View on Reddit
        </a>
      </div>
    );
  }

  return (
    <div
      className="reddit-embed"
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
    />
  );
};

export default RedditEmbed;
