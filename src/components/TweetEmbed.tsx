import React, { useEffect, useMemo, useRef, useState } from "react";

const TWITTER_WIDGETS_SRC = "https://platform.twitter.com/widgets.js";

let twitterWidgetsPromise: Promise<void> | null = null;

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed;
  return `https://${trimmed}`;
}

function extractTweetId(urlStr: string): string | null {
  const normalized = normalizeUrl(urlStr);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);

    // Common formats:
    // - https://x.com/{user}/status/{id}
    // - https://twitter.com/{user}/status/{id}
    // - https://mobile.twitter.com/{user}/status/{id}
    // - https://x.com/i/web/status/{id}
    const match = url.pathname.match(/\/status\/(\d+)/);
    if (match?.[1]) return match[1];

    return null;
  } catch {
    // Fallback: best-effort regex for raw strings
    const match = urlStr.match(/\/status\/(\d+)/);
    return match?.[1] ?? null;
  }
}

function loadTwitterWidgets(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  const win = window as unknown as {
    twttr?: { widgets?: { load?: () => void } };
  };
  if (win.twttr?.widgets) return Promise.resolve();

  if (twitterWidgetsPromise) return twitterWidgetsPromise;

  twitterWidgetsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TWITTER_WIDGETS_SRC}"]`,
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Twitter widgets")),
        {
          once: true,
        },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = TWITTER_WIDGETS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Twitter widgets"));
    document.head.appendChild(script);
  });

  return twitterWidgetsPromise;
}

export interface TweetEmbedProps {
  url: string;
}

const TweetEmbed: React.FC<TweetEmbedProps> = ({ url }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tweetId = useMemo(() => extractTweetId(url), [url]);
  const [failed, setFailed] = useState(false);

  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      setFailed(false);

      if (!tweetId || !containerRef.current) {
        setFailed(true);
        return;
      }

      containerRef.current.innerHTML = "";

      try {
        await loadTwitterWidgets();
        if (cancelled || !containerRef.current) return;

        const win = window as unknown as {
          twttr?: {
            widgets?: {
              createTweet?: (
                id: string,
                element: HTMLElement,
                options?: Record<string, unknown>,
              ) => Promise<unknown>;
              load?: () => void;
            };
          };
        };

        if (!win.twttr?.widgets?.createTweet) {
          setFailed(true);
          return;
        }

        await win.twttr.widgets.createTweet(tweetId, containerRef.current, {
          dnt: true,
          align: "center",
          conversation: "none",
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [tweetId]);

  return (
    <div className="tweet-embed" onClick={(e) => e.stopPropagation()}>
      {!failed ? (
        <div ref={containerRef} />
      ) : normalizedUrl ? (
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="card-link"
          onClick={(e) => e.stopPropagation()}
        >
          View post on X
        </a>
      ) : null}
    </div>
  );
};

export default TweetEmbed;
