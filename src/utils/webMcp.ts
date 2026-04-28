type JsonSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

interface WebMcpToolResult {
  status: "ok";
  url: string;
}

interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (input?: unknown) => WebMcpToolResult;
}

interface ModelContextApi {
  provideContext: (context: { tools: WebMcpTool[] }) => void | Promise<void>;
}

function getStringInput(input: unknown, key: string): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function navigateTo(path: string): WebMcpToolResult {
  const target = new URL(path, window.location.origin);
  window.location.assign(target.toString());
  return { status: "ok", url: target.toString() };
}

function saveUrlTo4Stash(input?: unknown): WebMcpToolResult {
  const target = new URL("/share-target", window.location.origin);
  const url = getStringInput(input, "url");
  const title = getStringInput(input, "title");
  const text = getStringInput(input, "text");

  if (url) target.searchParams.set("url", url);
  if (title) target.searchParams.set("title", title);
  if (text) target.searchParams.set("text", text);

  window.location.assign(target.toString());
  return { status: "ok", url: target.toString() };
}

export function registerWebMcpTools(): void {
  const nav = navigator as Navigator & { modelContext?: ModelContextApi };
  if (!nav.modelContext?.provideContext) return;

  void nav.modelContext.provideContext({
    tools: [
      {
        name: "save_url_to_4stash",
        description: "Save a URL, title, and optional note to the user's 4Stash account for later.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", format: "uri", description: "The URL to save." },
            title: { type: "string", description: "Optional title for the saved content." },
            text: { type: "string", description: "Optional note or description to save with the content." },
          },
          required: ["url"],
          additionalProperties: false,
        },
        execute: saveUrlTo4Stash,
      },
      {
        name: "open_4stash_dashboard",
        description: "Open the user's 4Stash dashboard to browse, search, and organize saved content.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: () => navigateTo("/dashboard"),
      },
      {
        name: "open_4stash_sign_in",
        description: "Open the 4Stash sign-in page so the user can authenticate or create an account.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: () => navigateTo("/login"),
      },
    ],
  });
}
