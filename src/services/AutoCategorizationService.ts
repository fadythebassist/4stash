import { AutoCategorizationResult, AutoCategorySuggestion } from "@/types";

interface CategorizeContentInput {
  title?: string;
  content?: string;
  url?: string;
  source?: string;
}

interface CategoryRule {
  name: string;
  icon: string;
  keywords: string[];
  domains?: string[];
  sources?: string[];
  tags: string[];
  priority?: number;
  requiredKeywordGroups?: string[][];
  bonusKeywords?: string[];
}

interface ScoredCategory extends AutoCategorySuggestion {
  score: number;
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    name: "AI",
    icon: "🤖",
    keywords: [
      "artificial intelligence",
      "claude",
      "chatgpt",
      "openai",
      "anthropic",
      "llm",
      "gpt",
      "prompt",
      "prompting",
      "copilot",
      "cursor",
      "ai agent",
      "ai tools",
      // Arabic
      "ذكاء اصطناعي",
      "الذكاء الاصطناعي",
      "نموذج لغوي",
      "تعلم آلي",
      "تعلم الآلة",
      "شات جي بي تي",
      "روبوت محادثة",
      "برومبت",
      "مساعد ذكي",
      "نماذج الذكاء",
      "أتمتة ذكية",
    ],
    domains: ["openai.com", "anthropic.com", "huggingface.co"],
    tags: ["ai", "technology"],
    priority: 1,
  },
  {
    name: "Coding",
    icon: "💻",
    keywords: [
      "developer",
      "coding",
      "programming",
      "typescript",
      "javascript",
      "react",
      "python",
      "api",
      "github",
      "terminal",
      "software engineer",
      // Arabic
      "برمجة",
      "مطور",
      "مطورين",
      "كود",
      "كودينج",
      "تطوير برمجيات",
      "تطوير تطبيقات",
      "مهندس برمجيات",
      "بايثون",
      "جافاسكريبت",
    ],
    domains: ["github.com", "stackoverflow.com", "vercel.com"],
    sources: ["github"],
    tags: ["coding", "technology"],
    priority: 1,
  },
  {
    name: "Technology",
    icon: "🖥️",
    keywords: [
      "software",
      "startup",
      "app",
      "saas",
      "tech",
      "product launch",
      "founder",
      "engineering",
      // Arabic
      "تقنية",
      "تكنولوجيا",
      "تطبيق",
      "شركة ناشئة",
      "ابتكار",
      "هندسة",
      "منتج رقمي",
      "منصة",
      "رقمي",
    ],
    domains: ["techcrunch.com", "theverge.com", "wired.com"],
    tags: ["technology"],
    priority: 1,
  },
  {
    name: "News",
    icon: "📰",
    keywords: [
      "breaking news",
      "breaking:",
      "headline",
      "news report",
      "news update",
      "journalist",
      "press release",
      "correspondent",
      "newsroom",
      // Arabic
      "أخبار",
      "خبر عاجل",
      "عاجل",
      "آخر الأخبار",
      "تقرير إخباري",
      "صحفي",
      "نشرة",
      "مستجدات",
      "بيان رسمي",
    ],
    domains: ["cnn.com", "bbc.com", "reuters.com", "nytimes.com", "aljazeera.com"],
    requiredKeywordGroups: [
      ["breaking news", "breaking:", "headline", "news report", "news update", "journalist",
       "press release", "correspondent", "newsroom",
       "أخبار", "خبر عاجل", "عاجل", "آخر الأخبار", "تقرير إخباري", "صحفي", "نشرة", "مستجدات", "بيان رسمي"],
    ],
    tags: ["news"],
    priority: 1,
  },
  {
    name: "Politics",
    icon: "🏛️",
    keywords: [
      "president",
      "government",
      "minister",
      "election",
      "policy",
      "congress",
      "parliament",
      "ceasefire",
      "iran",
      "gaza",
      "ukraine",
      "israel",
      "protest",
      "geopolitics",
      "diplomatic",
      "sanctions",
      // Arabic
      "سياسة",
      "حكومة",
      "رئيس",
      "وزير",
      "انتخابات",
      "برلمان",
      "حرب",
      "وقف إطلاق النار",
      "غزة",
      "فلسطين",
      "احتجاج",
      "مظاهرات",
      "دولة",
      "قرار سياسي",
      "مجلس",
    ],
    requiredKeywordGroups: [
      ["president", "government", "minister", "election", "policy", "congress",
       "parliament", "ceasefire", "iran", "gaza", "ukraine", "israel", "protest",
       "geopolitics", "diplomatic", "sanctions",
       "سياسة", "حكومة", "رئيس", "وزير", "انتخابات", "برلمان", "حرب",
       "وقف إطلاق النار", "غزة", "فلسطين", "احتجاج", "مظاهرات", "دولة", "قرار سياسي", "مجلس"],
    ],
    tags: ["politics", "news"],
    priority: 1,
  },
  {
    name: "Business",
    icon: "💼",
    keywords: [
      "business",
      "marketing",
      "brand",
      "sales",
      "company",
      "entrepreneur",
      "founder",
      "strategy",
      // Arabic
      "أعمال",
      "تسويق",
      "مبيعات",
      "شركة",
      "رائد أعمال",
      "ريادة أعمال",
      "علامة تجارية",
      "استراتيجية",
      "إدارة",
      "مشروع",
    ],
    domains: ["linkedin.com", "forbes.com", "inc.com"],
    tags: ["business"],
    priority: 1,
  },
  {
    name: "Finance",
    icon: "💸",
    keywords: [
      "finance",
      "stocks",
      "investing",
      "bitcoin",
      "crypto",
      "market",
      "economy",
      "trading",
      "polymarket",
      "wallet",
      "wallets",
      "profit",
      "income",
      "money",
      "earn",
      "earnings",
      "hedge fund",
      "portfolio",
      "revenue",
      // Arabic
      "مال",
      "أموال",
      "استثمار",
      "اقتصاد",
      "بورصة",
      "أسهم",
      "تداول",
      "عملة رقمية",
      "بيتكوين",
      "ميزانية",
      "ربح",
      "خسارة",
      "ادخار",
    ],
    domains: ["bloomberg.com", "wsj.com", "coindesk.com"],
    tags: ["finance", "business"],
    priority: 1,
  },
  {
    name: "Design",
    icon: "🎨",
    keywords: [
      "design",
      "ui",
      "ux",
      "figma",
      "branding",
      "logo",
      "typography",
      "visual identity",
      // Arabic
      "تصميم",
      "هوية بصرية",
      "شعار",
      "جرافيك",
      "ألوان",
      "تصميم جرافيك",
      "واجهة مستخدم",
      "تجربة مستخدم",
      "إبداع",
    ],
    domains: ["dribbble.com", "behance.net"],
    tags: ["design"],
    priority: 1,
  },
  {
    name: "Productivity",
    icon: "✅",
    keywords: [
      "workflow",
      "productivity",
      "focus",
      "habit",
      "habits",
      "automation",
      "time management",
      "system",
      // Arabic
      "إنتاجية",
      "تنظيم وقت",
      "إدارة الوقت",
      "عادات",
      "روتين",
      "أتمتة",
      "تركيز",
      "أهداف",
      "انضباط",
      "تحسين الذات",
    ],
    tags: ["productivity"],
    priority: 1,
  },
  {
    name: "Education",
    icon: "📚",
    keywords: [
      "tutorial",
      "guide",
      "lesson",
      "learn",
      "course",
      "study",
      "explained",
      "how to",
      // Arabic
      "تعلم",
      "تعليم",
      "درس",
      "دروس",
      "شرح",
      "كورس",
      "دورة",
      "دورة تدريبية",
      "مهارة",
      "مهارات",
      "تطوير الذات",
      "كيف",
      "كيفية",
      "طريقة",
    ],
    domains: ["coursera.org", "udemy.com", "khanacademy.org"],
    tags: ["education"],
    priority: 1,
  },
  {
    name: "Music",
    icon: "🎵",
    keywords: [
      "music",
      "song",
      "guitar",
      "piano",
      "album",
      "playlist",
      "concert",
      "splice",
      "beat",
      "lyrics",
      "vocalist",
      "singer",
      "band",
      "track",
      "single",
      "streaming",
      "music video",
      // Arabic
      "موسيقى",
      "أغنية",
      "أغاني",
      "فنان",
      "ألبوم",
      "طرب",
      "إيقاع",
      "حفلة",
      "مطرب",
      "مغني",
      "عزف",
      "كليب",
    ],
    domains: ["spotify.com", "soundcloud.com", "bandcamp.com", "anghami.com", "music.apple.com"],
    sources: ["spotify", "anghami", "soundcloud"],
    requiredKeywordGroups: [
      ["music", "song", "guitar", "piano", "album", "playlist", "concert", "splice",
       "beat", "lyrics", "vocalist", "singer", "band", "track", "single", "streaming",
       "music video",
       "موسيقى", "أغنية", "أغاني", "فنان", "ألبوم", "طرب", "إيقاع", "حفلة",
       "مطرب", "مغني", "عزف", "كليب"],
    ],
    tags: ["music"],
    priority: 2,
  },
  {
    name: "Fitness",
    icon: "🏋️",
    keywords: [
      "fitness",
      "workout",
      "gym",
      "exercise",
      "mobility",
      "protein",
      "high protein",
      "meal prep",
      "macros",
      "calories",
      "muscle",
      "training",
      "fat loss",
      "bodybuilding",
      // Arabic
      "رياضة",
      "لياقة",
      "لياقة بدنية",
      "تمرين",
      "تمارين",
      "صالة رياضة",
      "جيم",
      "عضلات",
      "بروتين",
      "سعرات حرارية",
      "حرق دهون",
      "بناء الجسم",
      "كارديو",
    ],
    bonusKeywords: ["progressive overload", "reps", "sets", "coach", "physique"],
    tags: ["fitness", "health"],
    priority: 0,
  },
  {
    name: "Food",
    icon: "🍕",
    keywords: [
      "recipe",
      "recipes",
      "cooking",
      "food",
      "meal",
      "meals",
      "healthy",
      "eat healthy",
      "nutrition",
      "ingredients",
      "kitchen",
      "meal prep",
      "chicken",
      "potatoes",
      "garlic",
      "cheesy",
      "chef",
      "restaurant",
      "dish",
      "oven bake",
      "sheet pan",
      "prep",
      "cookbook",
      "pasta",
      "rice",
      "sauce",
      // Arabic
      "طعام",
      "وصفة",
      "وصفات",
      "طبخ",
      "مطبخ",
      "أكل",
      "وجبة",
      "وجبات",
      "مكونات",
      "مقادير",
      "شيف",
      "طباخ",
      "مطعم",
      "حلويات",
      "دجاج",
      "لحم",
      "سمك",
      "أرز",
      "خبز",
      "صوص",
      "سلطة",
    ],
    bonusKeywords: ["instructions", "servings", "ingredients", "garnish", "bake", "cook"],
    requiredKeywordGroups: [
      ["recipe", "recipes", "ingredients", "cook", "cooking", "dish", "وصفة", "وصفات", "مكونات", "مقادير", "طبخ"],
      ["chicken", "potatoes", "pasta", "rice", "sauce", "meal", "food", "دجاج", "أرز", "لحم", "سمك", "طعام", "أكل", "وجبة"],
    ],
    tags: ["food", "recipe"],
    priority: 3,
  },
  {
    name: "Travel",
    icon: "✈️",
    keywords: [
      "travel",
      "trip",
      "flight",
      "vacation",
      "hotel",
      "itinerary",
      "destination",
      // Arabic
      "سفر",
      "رحلة",
      "سياحة",
      "فندق",
      "طيران",
      "وجهة سياحية",
      "جواز سفر",
      "تأشيرة",
      "عطلة",
      "برنامج سياحي",
    ],
    tags: ["travel"],
    priority: 1,
  },
  {
    name: "Gaming",
    icon: "🎮",
    keywords: [
      "game",
      "gaming",
      "xbox",
      "playstation",
      "steam",
      "nintendo",
      "esports",
      // Arabic
      "ألعاب",
      "لعبة",
      "ألعاب فيديو",
      "بلايستيشن",
      "إكس بوكس",
      "رياضات إلكترونية",
      "جيمنج",
      "بث مباشر",
    ],
    domains: ["ign.com", "gamespot.com"],
    tags: ["gaming"],
    priority: 1,
  },
  {
    name: "Health",
    icon: "🩺",
    keywords: [
      "health",
      "doctor",
      "medical",
      "nutrition",
      "healthy eating",
      "high protein",
      "meal prep",
      "macros",
      "mental health",
      "wellness",
      "low calorie",
      "weight loss",
      // Arabic
      "صحة",
      "طبيب",
      "طب",
      "علاج",
      "دواء",
      "مرض",
      "صحة نفسية",
      "صحة الجسم",
      "تغذية",
      "نظام صحي",
      "وزن",
      "إنقاص وزن",
      "رفاهية",
      "جهاز مناعي",
    ],
    tags: ["health"],
    priority: 1,
  },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isArabic(str: string): boolean {
  return /[\u0600-\u06FF]/.test(str);
}

// Short keywords that are too common as substrings — force word-boundary only, no fallback
const STRICT_BOUNDARY_KEYWORDS = new Set([
  "war", "app", "earn", "new", "hit", "hot", "top", "set", "run", "map",
  "bar", "bit", "net", "art", "act", "rap", "pop", "fit", "mix", "cut",
  "tip", "job", "key", "led", "fan", "pay", "oil", "low", "raw", "bet",
]);

function hasKeyword(text: string, keyword: string): boolean {
  // Arabic text has no whitespace word boundaries between all tokens,
  // so fall back to simple substring match for Arabic keywords.
  if (isArabic(keyword)) return text.includes(keyword);
  if (keyword.includes(" ")) return text.includes(keyword);
  // Short/common words: word-boundary only — no substring fallback
  // (prevents "war" matching "award", "app" matching "happy", etc.)
  const wordBoundaryRegex = new RegExp(`(^|\\W)${escapeRegex(keyword)}(?=$|\\W)`, "i");
  if (STRICT_BOUNDARY_KEYWORDS.has(keyword.toLowerCase())) {
    return wordBoundaryRegex.test(text);
  }
  // For other single-word keywords, try word-boundary match first, then substring
  // (handles cases like "market" inside "Polymarket" or "claude" in normal text)
  if (wordBoundaryRegex.test(text)) return true;
  // Substring fallback so compound words (e.g. "Polymarket") still match "market"
  return text.includes(keyword);
}

function getHostname(url?: string): string {
  if (!url) return "";
  try {
    const normalized =
      url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function getPlatformTag(url?: string, source?: string): string | undefined {
  if (source) return source.toLowerCase();
  const hostname = getHostname(url);
  if (!hostname) return undefined;
  if (hostname.includes("instagram")) return "instagram";
  if (hostname.includes("threads")) return "threads";
  if (hostname.includes("youtube") || hostname.includes("youtu.be")) return "youtube";
  if (hostname.includes("tiktok")) return "tiktok";
  if (hostname.includes("reddit")) return "reddit";
  if (hostname.includes("facebook") || hostname.includes("fb.watch")) return "facebook";
  if (hostname.includes("x.com") || hostname.includes("twitter")) return "twitter";
  return undefined;
}

function getFormatTags(url?: string, source?: string): string[] {
  const lowerUrl = (url || "").toLowerCase();
  const tags: string[] = [];

  if (
    lowerUrl.includes("youtube.com") ||
    lowerUrl.includes("youtu.be") ||
    lowerUrl.includes("tiktok.com") ||
    lowerUrl.includes("vimeo.com") ||
    lowerUrl.includes("/reel/") ||
    lowerUrl.includes("/video") ||
    lowerUrl.includes("fb.watch") ||
    source === "youtube" ||
    source === "tiktok" ||
    source === "vimeo"
  ) {
    tags.push("video");
  }

  if (lowerUrl.includes("/p/") || lowerUrl.includes("/photo") || lowerUrl.includes("image")) {
    tags.push("image");
  }

  return tags;
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function getMatchBreakdown(text: string, rule: CategoryRule, hostname: string, source?: string): {
  matchedKeywords: string[];
  matchedDomains: string[];
  matchedSources: string[];
  bonusMatches: string[];
  groupedMatchBonus: number;
} {
  const matchedKeywords = rule.keywords.filter((keyword) => hasKeyword(text, keyword));
  const matchedDomains = (rule.domains || []).filter((domain) => hostname.includes(domain));
  const matchedSources = (rule.sources || []).filter((candidate) => candidate === source);
  const bonusMatches = (rule.bonusKeywords || []).filter((keyword) => hasKeyword(text, keyword));
  const groupedMatchBonus = (rule.requiredKeywordGroups || []).every((group) =>
    group.some((keyword) => hasKeyword(text, keyword)),
  )
    ? 3
    : 0;

  return {
    matchedKeywords,
    matchedDomains,
    matchedSources,
    bonusMatches,
    groupedMatchBonus,
  };
}

function buildScoredCategory(
  rule: CategoryRule,
  text: string,
  hostname: string,
  source?: string,
): ScoredCategory | null {
  const { matchedKeywords, matchedDomains, matchedSources, bonusMatches, groupedMatchBonus } =
    getMatchBreakdown(text, rule, hostname, source);

  const score =
    matchedKeywords.length * 2 +
    matchedDomains.length * 3 +
    matchedSources.length * 2 +
    bonusMatches.length +
    groupedMatchBonus +
    (rule.priority || 0);

  const matchedItems = unique([
    ...matchedKeywords,
    ...matchedDomains,
    ...matchedSources,
    ...bonusMatches,
  ]);

  if (!matchedItems.length || score < 2) {
    return null;
  }

  const confidence = Math.min(98, score * 10 + 30);

  return {
    name: rule.name,
    icon: rule.icon,
    confidence,
    matchedKeywords: matchedItems,
    score,
  };
}

function getAutoCategories(categories: ScoredCategory[]): AutoCategorySuggestion[] {
  const topCategory = categories[0];
  if (!topCategory || topCategory.confidence < 60) {
    return [];
  }

  return categories
    .filter((category, index) => {
      if (index === 0) return true;
      const confidenceGap = topCategory.confidence - category.confidence;
      return category.confidence >= 60 && confidenceGap <= 15;
    })
    .slice(0, 3)
    .map(({ score: _score, ...category }) => category);
}

export function categorizeContent(input: CategorizeContentInput): AutoCategorizationResult {
  const title = input.title?.trim() || "";
  const content = input.content?.trim() || "";
  const source = input.source?.trim().toLowerCase();
  const hostname = getHostname(input.url);
  const text = `${title} ${content} ${hostname} ${source || ""}`.toLowerCase();

  const scoredCategories = CATEGORY_RULES.map((rule) =>
    buildScoredCategory(rule, text, hostname, source),
  )
    .filter((category): category is ScoredCategory => category !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.confidence - a.confidence;
    });

  const categories: AutoCategorySuggestion[] = scoredCategories.map(({ score: _score, ...category }) => category);
  const autoCategories = getAutoCategories(scoredCategories);
  const topCategory = categories[0];
  const secondCategory = categories[1];
  const suggestedCategory =
    topCategory && (!secondCategory || topCategory.confidence - secondCategory.confidence >= 8)
      ? topCategory
      : topCategory?.confidence >= 60
        ? topCategory
        : undefined;
  const autoCategory = autoCategories[0];

  const matchedRuleTags = autoCategories.length > 0
    ? autoCategories.flatMap((category) => {
        const rule = CATEGORY_RULES.find((candidate) => candidate.name === category.name);
        return rule?.tags || [];
      })
    : topCategory && topCategory.confidence >= 60
      ? (CATEGORY_RULES.find((candidate) => candidate.name === topCategory.name)?.tags || [])
      : [];

  const platformTag = getPlatformTag(input.url, source);
  const tags = unique([
    ...(platformTag ? [platformTag] : []),
    ...getFormatTags(input.url, source),
    ...matchedRuleTags,
  ]).slice(0, 10);

  return {
    tags,
    categories,
    autoCategories,
    autoCategory,
    suggestedCategory,
  };
}
