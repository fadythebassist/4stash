import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "test-results", "prod-live");
const storageStatePath = path.join(
  rootDir,
  "test-results",
  "prod-auth",
  "storage-state.json",
);

fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
});

const context = await browser.newContext({
  storageState: storageStatePath,
  viewport: { width: 1440, height: 960 },
});

const page = await context.newPage();
const cases = [
  {
    id: "github_repo",
    label: "GitHub repo card",
    url: "https://github.com/microsoft/vscode",
  },
  {
    id: "youtube_watch",
    label: "YouTube watch video",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  {
    id: "vimeo_video",
    label: "Vimeo video",
    url: "https://vimeo.com/148751763",
  },
  {
    id: "facebook_public_post",
    label: "Facebook public post",
    url: "https://www.facebook.com/61570753006007/posts/122117891708691766/",
  },
  {
    id: "facebook_group_post",
    label: "Facebook group post",
    url: "https://www.facebook.com/groups/2212902185/posts/10162051716112186/",
  },
  {
    id: "facebook_profile_post",
    label: "Facebook profile-style post",
    url: "https://www.facebook.com/asa.watanabe.872287/posts/groups-that-hybe-has-been-exposed-for-shaming-and-bad-mouthing-within-the-compan/472629322461978/",
  },
  {
    id: "instagram_reel",
    label: "Instagram reel",
    url: "https://www.instagram.com/instagram/reel/DXR2tCQADb5/",
  },
  {
    id: "instagram_post",
    label: "Instagram post",
    url: "https://www.instagram.com/instagram/p/DXNYtNlAZUK/",
  },
  {
    id: "threads_text_post",
    label: "Threads post without inline video",
    url: "https://www.threads.com/@zuck/post/DW4Gb79kQc0",
  },
  {
    id: "threads_video_post",
    label: "Threads post with inline video",
    url: "https://www.threads.com/@zuck/post/DVrwsE5EdSz",
  },
];

function sanitizeFilePart(value) {
  return value.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
}

async function openDashboard() {
  await page.goto("https://4stash.com/dashboard", {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.waitForSelector('button[aria-label="Add new item"]', {
    timeout: 60_000,
  });
}

async function closeModalIfOpen() {
  const modal = page.locator(".modal-content");
  if (await modal.isVisible().catch(() => false)) {
    const close = page.locator(".modal-close").first();
    if (await close.isVisible().catch(() => false)) {
      await close.click().catch(() => {});
    }
  }
}

async function addItem(url) {
  await closeModalIfOpen();
  await page.click('button[aria-label="Add new item"]');
  await page.waitForSelector("#url", { timeout: 30_000 });
  await page.fill("#url", url);
  await page.waitForFunction(() => {
    const el = document.querySelector("#title");
    return (
      el &&
      !el.disabled &&
      typeof el.value === "string" &&
      el.value.trim().length > 0
    );
  }, { timeout: 90_000 });

  const title = await page.inputValue("#title");
  const countBefore = await page.locator(".content-card").count();

  await page.click("button.btn.btn-primary");
  await page.locator(".modal-content").waitFor({ state: "hidden", timeout: 120_000 });

  await page.waitForFunction(
    (previous, expectedTitle) => {
      const cards = Array.from(document.querySelectorAll(".content-card"));
      return (
        cards.length > previous ||
        cards.some((card) => card.textContent?.includes(expectedTitle))
      );
    },
    countBefore,
    title,
    { timeout: 120_000 },
  );

  const card = page.locator(".content-card", { hasText: title }).first();
  await card.waitFor({ state: "visible", timeout: 60_000 });
  await card.scrollIntoViewIfNeeded();

  return { title, card };
}

async function summarizeCard(card) {
  return await card.evaluate((node) => ({
    text: (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 1000),
    classes: node.className,
    hasSourceBadge: !!node.querySelector(".source-badge"),
    hasCardLink: !!node.querySelector(".card-link"),
    hasYouTubeEmbed: !!node.querySelector(".youtube-embed-container"),
    hasVimeoEmbed: !!node.querySelector(".vimeo-embed-container"),
    hasInstagramEmbed: !!node.querySelector(".instagram-embed"),
    hasTweetEmbed: !!node.querySelector(".tweet-embed"),
    hasRedditEmbed: !!node.querySelector(".reddit-embed"),
    hasFacebookEmbed: !!node.querySelector(
      ".facebook-post-embed, .facebook-video-embed, .fb-card",
    ),
    hasThreadsFallbackCard: !!node.querySelector(".fb-card"),
    iframeCount: node.querySelectorAll("iframe").length,
    videoCount: node.querySelectorAll("video").length,
    imageCount: node.querySelectorAll("img").length,
  }));
}

const results = {
  startedAt: new Date().toISOString(),
  cases: [],
  uxChecks: {},
};

try {
  await openDashboard();

  results.uxChecks.initialDashboard = await page.evaluate(() => ({
    url: location.href,
    emptyStateVisible: document.body.innerText.includes("No items yet"),
    quickBinVisible: document.body.innerText.includes("Quick Bin"),
    favoritesVisible: document.body.innerText.includes("Favorites"),
  }));

  for (const testCase of cases) {
    const fileBase = sanitizeFilePart(testCase.id);
    const result = {
      ...testCase,
      status: "passed",
      startedAt: new Date().toISOString(),
    };

    try {
      const { title, card } = await addItem(testCase.url);
      result.autoTitle = title;
      result.card = await summarizeCard(card);
      await card.screenshot({
        path: path.join(outputDir, `${fileBase}.png`),
      });
    } catch (error) {
      result.status = "failed";
      result.error = String(error);
      await page.screenshot({
        path: path.join(outputDir, `${fileBase}-failure.png`),
        fullPage: true,
      });
      await closeModalIfOpen();
    }

    result.finishedAt = new Date().toISOString();
    results.cases.push(result);
  }

  const settingsButton = page.locator('button[title="Settings"]').first();
  if (await settingsButton.isVisible().catch(() => false)) {
    await settingsButton.click();
    await page.waitForTimeout(1500);
    results.uxChecks.settingsModal = {
      opened: true,
      bodyText: (await page.locator("body").innerText()).slice(0, 1200),
    };
    await page.locator(".modal-close").first().click().catch(() => {});
  }

  const search = page.locator('input[type="search"]').first();
  if (await search.isVisible().catch(() => false)) {
    await search.fill("GitHub - microsoft/vscode");
    await page.waitForTimeout(1000);
    results.uxChecks.search = {
      query: "GitHub - microsoft/vscode",
      bodyText: (await page.locator("body").innerText()).slice(0, 1200),
    };
    await search.fill("");
  }
} finally {
  results.finishedAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(outputDir, "results.json"),
    JSON.stringify(results, null, 2),
  );
  await context.close();
  await browser.close();
}
