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
      "machine learning",
      "deep learning",
      "neural network",
      "large language model",
      "claude",
      "chatgpt",
      "openai",
      "anthropic",
      "llm",
      "gpt",
      "gpt-4",
      "gemini",
      "mistral",
      "llama",
      "prompt",
      "prompting",
      "copilot",
      "cursor",
      "ai agent",
      "ai tools",
      "stable diffusion",
      "midjourney",
      "dall-e",
      "diffusion model",
      "rag",
      "fine-tuning",
      "transformer",
      "embedding",
      "vector database",
      "langchain",
      "generative ai",
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
      "شبكة عصبية",
      "توليد نصوص",
      "توليد صور",
    ],
    domains: ["openai.com", "anthropic.com", "huggingface.co", "midjourney.com"],
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
      "rust",
      "golang",
      "java",
      "swift",
      "kotlin",
      "api",
      "github",
      "terminal",
      "software engineer",
      "open source",
      "pull request",
      "debugging",
      "refactor",
      "frontend",
      "backend",
      "fullstack",
      "devops",
      "docker",
      "kubernetes",
      "ci/cd",
      "database",
      "sql",
      "nosql",
      "graphql",
      "rest api",
      "web development",
      "mobile development",
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
      "مفتوح المصدر",
      "واجهة برمجية",
      "قاعدة بيانات",
    ],
    domains: ["github.com", "stackoverflow.com", "vercel.com", "npmjs.com", "dev.to"],
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
      "hardware",
      "gadget",
      "device",
      "smartphone",
      "laptop",
      "review",
      "unboxing",
      "benchmark",
      "cybersecurity",
      "privacy",
      "data breach",
      "cloud computing",
      "silicon valley",
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
      "أمن إلكتروني",
      "خصوصية",
      "حوسبة سحابية",
      "هاتف",
      "جهاز",
    ],
    domains: ["techcrunch.com", "theverge.com", "wired.com", "arstechnica.com", "macrumors.com", "9to5mac.com"],
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
      "report:",
      "just in",
      "developing story",
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
      "وكالة أنباء",
    ],
    domains: ["cnn.com", "bbc.com", "reuters.com", "nytimes.com", "aljazeera.com", "apnews.com", "theguardian.com"],
    requiredKeywordGroups: [
      ["breaking news", "breaking:", "headline", "news report", "news update", "journalist",
       "press release", "correspondent", "newsroom", "report:", "just in", "developing story",
       "أخبار", "خبر عاجل", "عاجل", "آخر الأخبار", "تقرير إخباري", "صحفي", "نشرة", "مستجدات", "بيان رسمي", "وكالة أنباء"],
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
      "senate",
      "supreme court",
      "white house",
      "constitution",
      "referendum",
      "coup",
      "democracy",
      "regime",
      "militia",
      "nato",
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
      "دستور",
      "استفتاء",
      "ديمقراطية",
      "معارضة",
      "ثورة",
    ],
    requiredKeywordGroups: [
      ["president", "government", "minister", "election", "policy", "congress",
       "parliament", "ceasefire", "iran", "gaza", "ukraine", "israel", "protest",
       "geopolitics", "diplomatic", "sanctions", "senate", "supreme court",
       "white house", "constitution", "referendum", "coup", "democracy", "regime",
       "militia", "nato",
       "سياسة", "حكومة", "رئيس", "وزير", "انتخابات", "برلمان", "حرب",
       "وقف إطلاق النار", "غزة", "فلسطين", "احتجاج", "مظاهرات", "دولة", "قرار سياسي", "مجلس",
       "دستور", "استفتاء", "ديمقراطية", "معارضة", "ثورة"],
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
      "startup",
      "acquisition",
      "merger",
      "ipo",
      "valuation",
      "b2b",
      "b2c",
      "growth hacking",
      "product market fit",
      "pitch deck",
      "venture capital",
      "angel investor",
      "ceo",
      "leadership",
      "management",
      "operations",
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
      "استثمار مغامر",
      "اندماج",
      "استحواذ",
      "قيادة",
      "نمو",
    ],
    domains: ["linkedin.com", "forbes.com", "inc.com", "hbr.org", "businessinsider.com"],
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
      "interest rate",
      "inflation",
      "recession",
      "federal reserve",
      "nasdaq",
      "s&p 500",
      "etf",
      "dividend",
      "real estate",
      "mortgage",
      "defi",
      "nft",
      "web3",
      "ethereum",
      "solana",
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
      "تضخم",
      "فائدة",
      "عقارات",
      "صناديق",
    ],
    domains: ["bloomberg.com", "wsj.com", "coindesk.com", "investopedia.com", "marketwatch.com"],
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
      "color palette",
      "wireframe",
      "prototype",
      "design system",
      "illustration",
      "motion design",
      "animation",
      "adobe",
      "photoshop",
      "illustrator",
      "canva",
      "aesthetic",
      "minimalist",
      "creative direction",
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
      "رسم",
      "لوحة ألوان",
      "تصميم داخلي",
    ],
    domains: ["dribbble.com", "behance.net", "figma.com"],
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
      "second brain",
      "pkm",
      "note-taking",
      "deep work",
      "pomodoro",
      "to-do",
      "task management",
      "inbox zero",
      "notion",
      "obsidian",
      "roam",
      "morning routine",
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
      "تدوين ملاحظات",
      "إدارة مهام",
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
      "beginner",
      "advanced",
      "lecture",
      "university",
      "college",
      "school",
      "degree",
      "certification",
      "bootcamp",
      "workshop",
      "masterclass",
      "knowledge",
      "tips",
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
      "نصائح",
      "جامعة",
      "شهادة",
    ],
    domains: ["coursera.org", "udemy.com", "khanacademy.org", "edx.org", "skillshare.com"],
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
      "producer",
      "dj",
      "rap",
      "hip hop",
      "pop",
      "jazz",
      "classical",
      "indie",
      "edm",
      "r&b",
      "release",
      "setlist",
      "tour",
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
      "بلاي ليست",
      "بودكاست موسيقي",
    ],
    domains: ["spotify.com", "soundcloud.com", "bandcamp.com", "anghami.com", "music.apple.com", "tidal.com"],
    sources: ["spotify", "anghami", "soundcloud"],
    requiredKeywordGroups: [
      ["music", "song", "guitar", "piano", "album", "playlist", "concert", "splice",
       "beat", "lyrics", "vocalist", "singer", "band", "track", "single", "streaming",
       "music video", "producer", "dj", "rap", "hip hop", "pop", "jazz", "classical",
       "indie", "edm", "r&b", "release", "setlist", "tour",
       "موسيقى", "أغنية", "أغاني", "فنان", "ألبوم", "طرب", "إيقاع", "حفلة",
       "مطرب", "مغني", "عزف", "كليب", "بلاي ليست", "بودكاست موسيقي"],
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
      "weightlifting",
      "cardio",
      "running",
      "hiit",
      "crossfit",
      "yoga",
      "stretching",
      "pull-ups",
      "squat",
      "deadlift",
      "bench press",
      "abs",
      "cutting",
      "bulking",
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
      "يوغا",
      "تمدد",
      "تخسيس",
    ],
    bonusKeywords: ["progressive overload", "reps", "sets", "coach", "physique", "pr", "form"],
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
      "vegan",
      "vegetarian",
      "gluten-free",
      "keto",
      "air fryer",
      "slow cooker",
      "dessert",
      "baking",
      "breakfast",
      "brunch",
      "lunch",
      "dinner",
      "snack",
      "street food",
      "cuisine",
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
      "مقبلات",
      "عصير",
      "كيكة",
      "حساء",
      "شوربة",
    ],
    bonusKeywords: ["instructions", "servings", "ingredients", "garnish", "bake", "cook", "simmer", "marinate"],
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
      "backpacking",
      "road trip",
      "solo travel",
      "budget travel",
      "travel vlog",
      "hidden gem",
      "must visit",
      "things to do",
      "travel guide",
      "packing list",
      "hostel",
      "resort",
      "airbnb",
      "visa",
      "passport",
      "layover",
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
      "حجز",
      "منتجع",
      "شاطئ",
      "مغامرة",
      "استكشاف",
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
      "twitch",
      "streamer",
      "gamer",
      "multiplayer",
      "fps",
      "rpg",
      "moba",
      "battle royale",
      "speedrun",
      "mod",
      "patch",
      "dlc",
      "early access",
      "indie game",
      "video game",
      "console",
      "pc gaming",
      // Arabic
      "ألعاب",
      "لعبة",
      "ألعاب فيديو",
      "بلايستيشن",
      "إكس بوكس",
      "رياضات إلكترونية",
      "جيمنج",
      "بث مباشر",
      "بث ألعاب",
      "لاعب",
      "تشويق",
    ],
    domains: ["ign.com", "gamespot.com", "twitch.tv", "epicgames.com"],
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
      "sleep",
      "stress",
      "anxiety",
      "depression",
      "therapy",
      "meditation",
      "mindfulness",
      "supplements",
      "vitamins",
      "gut health",
      "immune system",
      "longevity",
      "biohacking",
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
      "نوم",
      "توتر",
      "قلق",
      "تأمل",
      "مكملات",
      "فيتامينات",
    ],
    tags: ["health"],
    priority: 1,
  },
  {
    name: "Science",
    icon: "🔬",
    keywords: [
      "science",
      "research",
      "study",
      "physics",
      "chemistry",
      "biology",
      "astronomy",
      "space",
      "nasa",
      "spacex",
      "climate",
      "climate change",
      "environment",
      "evolution",
      "genetics",
      "psychology",
      "neuroscience",
      "experiment",
      "discovery",
      "publication",
      "peer review",
      "journal",
      // Arabic
      "علم",
      "علوم",
      "بحث علمي",
      "دراسة",
      "فيزياء",
      "كيمياء",
      "أحياء",
      "فضاء",
      "ناسا",
      "بيئة",
      "تغير مناخي",
      "وراثة",
      "علم نفس",
      "اكتشاف",
      "تجربة",
    ],
    domains: ["nature.com", "sciencemag.org", "nationalgeographic.com", "nasa.gov"],
    tags: ["science"],
    priority: 1,
  },
  {
    name: "Sports",
    icon: "⚽",
    keywords: [
      "football",
      "soccer",
      "basketball",
      "tennis",
      "cricket",
      "baseball",
      "nba",
      "nfl",
      "premier league",
      "champions league",
      "world cup",
      "olympics",
      "athlete",
      "match",
      "tournament",
      "championship",
      "transfer",
      "goal",
      "score",
      "highlights",
      "season",
      "formula 1",
      "f1",
      "mma",
      "boxing",
      "ufc",
      // Arabic
      "كرة قدم",
      "كرة السلة",
      "رياضة",
      "بطولة",
      "دوري",
      "مباراة",
      "لاعب",
      "هدف",
      "منتخب",
      "كأس العالم",
      "أولمبياد",
      "ملخص",
      "الدوري الإنجليزي",
      "ريال مدريد",
      "برشلونة",
    ],
    requiredKeywordGroups: [
      ["football", "soccer", "basketball", "tennis", "cricket", "baseball",
       "nba", "nfl", "premier league", "champions league", "world cup", "olympics",
       "athlete", "match", "tournament", "championship", "transfer", "goal",
       "score", "highlights", "season", "formula 1", "f1", "mma", "boxing", "ufc",
       "كرة قدم", "كرة السلة", "بطولة", "دوري", "مباراة", "لاعب", "هدف",
       "منتخب", "كأس العالم", "أولمبياد", "ملخص", "الدوري الإنجليزي"],
    ],
    tags: ["sports"],
    priority: 1,
  },
  {
    name: "Entertainment",
    icon: "🎬",
    keywords: [
      "movie",
      "film",
      "series",
      "tv show",
      "netflix",
      "disney",
      "hbo",
      "trailer",
      "review",
      "actor",
      "director",
      "oscar",
      "emmy",
      "streaming",
      "cinema",
      "plot",
      "season",
      "episode",
      "binge",
      "anime",
      "manga",
      "celebrity",
      "hollywood",
      // Arabic
      "فيلم",
      "مسلسل",
      "مسرحية",
      "ممثل",
      "نتفليكس",
      "ديزني",
      "مشاهدة",
      "سينما",
      "مسلسلات",
      "دراما",
      "كوميديا",
      "رعب",
      "أكشن",
      "نجم",
      "مخرج",
    ],
    requiredKeywordGroups: [
      ["movie", "film", "series", "tv show", "netflix", "disney", "hbo",
       "trailer", "actor", "director", "oscar", "emmy", "cinema", "season",
       "episode", "binge", "anime", "manga", "celebrity", "hollywood",
       "فيلم", "مسلسل", "ممثل", "نتفليكس", "ديزني", "مشاهدة", "سينما",
       "مسلسلات", "دراما", "كوميديا", "رعب", "أكشن", "نجم", "مخرج"],
    ],
    domains: ["imdb.com", "rottentomatoes.com"],
    tags: ["entertainment"],
    priority: 1,
  },
  {
    name: "Photography",
    icon: "📸",
    keywords: [
      "photography",
      "photo",
      "camera",
      "lens",
      "portrait",
      "landscape",
      "lightroom",
      "photoshop",
      "raw",
      "exposure",
      "aperture",
      "shutter speed",
      "iso",
      "bokeh",
      "composition",
      "street photography",
      "wildlife photography",
      "drone",
      "videography",
      // Arabic
      "تصوير",
      "صورة",
      "كاميرا",
      "عدسة",
      "بورتريه",
      "تصوير طبيعة",
      "تحرير صور",
      "درون",
      "فيديوغرافي",
    ],
    requiredKeywordGroups: [
      ["photography", "photo", "camera", "lens", "portrait", "landscape",
       "lightroom", "exposure", "aperture", "shutter speed", "bokeh",
       "composition", "street photography", "drone", "videography",
       "تصوير", "كاميرا", "عدسة", "بورتريه", "تحرير صور"],
    ],
    tags: ["photography"],
    priority: 1,
  },
  {
    name: "Fashion",
    icon: "👗",
    keywords: [
      "fashion",
      "style",
      "outfit",
      "clothing",
      "streetwear",
      "luxury",
      "brand",
      "collection",
      "runway",
      "trend",
      "wardrobe",
      "fit",
      "ootd",
      "lookbook",
      "thrift",
      "vintage",
      "sneakers",
      // Arabic
      "موضة",
      "أزياء",
      "ملابس",
      "ستايل",
      "تنسيق",
      "إطلالة",
      "ماركة",
      "مجوهرات",
      "أحذية",
      "حقيبة",
    ],
    requiredKeywordGroups: [
      ["fashion", "style", "outfit", "clothing", "streetwear", "luxury",
       "collection", "runway", "trend", "wardrobe", "ootd", "lookbook",
       "thrift", "vintage", "sneakers",
       "موضة", "أزياء", "ملابس", "ستايل", "تنسيق", "إطلالة", "ماركة"],
    ],
    tags: ["fashion"],
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
  // Sports acronyms that appear as substrings in common words
  "mma", "nba", "nfl", "ufc", "f1",
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
