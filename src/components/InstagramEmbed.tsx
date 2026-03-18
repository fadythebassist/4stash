import React, { useEffect, useMemo, useState } from "react";

const INSTAGRAM_EMBEDS_SRC = "https://www.instagram.com/embed.js";

let instagramEmbedsPromise: Promise<void> | null = null;

function normalizeUrl(urlStr: string): string | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
    return trimmed;
  return `https://${trimmed}`;
}

function loadInstagramEmbeds(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  const win = window as unknown as {
    instgrm?: { Embeds?: { process?: () => void } };
  };
  if (win.instgrm?.Embeds) return Promise.resolve();

  if (instagramEmbedsPromise) return instagramEmbedsPromise;

  instagramEmbedsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${INSTAGRAM_EMBEDS_SRC}"]`,
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Instagram embeds")),
        {
          once: true,
        },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = INSTAGRAM_EMBEDS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Instagram embeds"));
    document.head.appendChild(script);
  });

  return instagramEmbedsPromise;
}

export interface InstagramEmbedProps {
  url: string;
}

const InstagramEmbed: React.FC<InstagramEmbedProps> = ({ url }) => {
  const [failed, setFailed] = useState(false);
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      setFailed(false);
      if (!normalizedUrl) {
        setFailed(true);
        return;
      }

      try {
        await loadInstagramEmbeds();
        if (cancelled) return;

        const win = window as unknown as {
          instgrm?: { Embeds?: { process?: () => void } };
        };
        win.instgrm?.Embeds?.process?.();
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [normalizedUrl]);

  return (
    <div className="instagram-embed" onClick={(e) => e.stopPropagation()}>
      {!failed && normalizedUrl ? (
        <blockquote
          className="instagram-media"
          data-instgrm-permalink={normalizedUrl}
          data-instgrm-version="14"
        >
          <a href={normalizedUrl} target="_blank" rel="noopener noreferrer">
            View this post on Instagram
          </a>
        </blockquote>
      ) : normalizedUrl ? (
        <a
          href={normalizedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="card-link"
          onClick={(e) => e.stopPropagation()}
        >
          View on Instagram
        </a>
      ) : null}
    </div>
  );
};

export default InstagramEmbed;
