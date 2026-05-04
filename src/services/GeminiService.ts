const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";
const GEMINI_TIMEOUT_MS = 8000;

export interface GeminiTagResult {
  tags: string[];
  /** Names of the user's existing lists that Gemini thinks this item belongs in */
  listNames: string[];
  /**
   * A new list name to create if none of the existing lists are a good fit.
   * Only set when Gemini is confident a new dedicated list would be useful.
   * Null/undefined when an existing list is a good enough match.
   */
  newListName?: string;
}

interface GeminiCandidate {
  content?: { parts?: { text?: string }[] };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

/**
 * Ask Gemini to suggest tags and list placement for a saved item.
 * Gemini may match existing lists by name, or propose a new list name
 * when no existing list fits well.
 *
 * @param title        - Item title (may be empty)
 * @param content      - Item description/notes (may be empty)
 * @param url          - Item URL (may be empty)
 * @param source       - Detected platform (e.g. "youtube", "twitter")
 * @param existingTags - All tags the user has already used (for consistency)
 * @param listNames    - Names of the user's existing lists (for matching)
 */
export async function getGeminiSuggestions(
  title: string,
  content: string,
  url: string,
  source: string | undefined,
  existingTags: string[],
  listNames: string[],
): Promise<GeminiTagResult> {
  if (!GEMINI_API_KEY) {
    console.warn("[GeminiService] VITE_GEMINI_API_KEY is not set — skipping AI suggestions");
    return { tags: [], listNames: [] };
  }

  const existingTagsSnippet =
    existingTags.length > 0
      ? `The user already uses these tags (prefer reusing them when relevant): ${existingTags.slice(0, 60).join(", ")}.`
      : "";

  const listsSnippet =
    listNames.length > 0
      ? `The user has these lists: ${listNames.join(", ")}.`
      : "The user has no lists yet.";

  const prompt = `You are a content organisation assistant for a bookmarking app called 4Stash.

Given the following saved item, return a JSON object with exactly these keys:
- "tags": an array of 3–7 short lowercase tags (single words or short phrases, no "#" prefix)
- "listNames": an array of 0–2 names from the user's EXISTING lists that this item clearly belongs in (exact match, case-insensitive). Only include a list if it is a genuinely good fit. Return [] if none match well.
- "newListName": a short, descriptive list name (Title Case, 1–3 words) to CREATE if none of the existing lists are a good fit for this item. Set to null if an existing list already covers it.

Rules:
- "listNames" + "newListName" together must result in at most 2 lists being assigned.
- If "listNames" already has 2 entries, set "newListName" to null.
- If "listNames" has 1 entry and the item also warrants a second distinct category not covered by existing lists, you may set "newListName".
- If "listNames" is empty and the item clearly belongs in a category, propose a "newListName".
- Never create a new list if an existing one is a reasonable match.
- Keep "newListName" concise and universal (e.g. "Recipes", "Tech News", "Workouts") — not too specific.

${existingTagsSnippet}
${listsSnippet}

Item details:
- Title: ${title || "(none)"}
- Description: ${content || "(none)"}
- URL: ${url || "(none)"}
- Platform/Source: ${source || "(unknown)"}

Respond ONLY with a valid JSON object, no markdown, no explanation. Example:
{"tags":["ai","productivity","tools"],"listNames":["Tech"],"newListName":"AI Tools"}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 300,
        },
      }),
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      console.error("[GeminiService] API error:", response.status, await response.text());
      return { tags: [], listNames: [] };
    }

    const data = (await response.json()) as GeminiResponse;
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    const parsed = JSON.parse(cleaned) as {
      tags?: unknown;
      listNames?: unknown;
      newListName?: unknown;
    };

    const tags = Array.isArray(parsed.tags)
      ? (parsed.tags as unknown[])
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.toLowerCase().trim())
          .filter(Boolean)
      : [];

    const suggestedListNames = Array.isArray(parsed.listNames)
      ? (parsed.listNames as unknown[])
          .filter((l): l is string => typeof l === "string")
          .map((l) => l.trim())
          .filter(Boolean)
      : [];

    const newListName =
      typeof parsed.newListName === "string" && parsed.newListName.trim()
        ? parsed.newListName.trim()
        : undefined;

    return { tags, listNames: suggestedListNames, newListName };
  } catch (err) {
    console.error("[GeminiService] Failed to get suggestions:", err);
    return { tags: [], listNames: [] };
  }
}
