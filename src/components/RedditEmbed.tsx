import React, { useEffect, useMemo, useRef, useState } from "react";

const REDDIT_WIDGETS_SRC = "https://embed.reddit.com/widgets.js";

let redditWidgetsPromise: Promise<void> | null = null;

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed;
  return `https://${trimmed}`;
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
        // The script auto-processes inserted cards.
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    render();

    return () => {
      cancelled = true;
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
