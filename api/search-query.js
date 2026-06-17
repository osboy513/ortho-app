import OpenAI from "openai";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const SEARCH_PROMPT_VERSION = "ortho-search-query-v1";
const SUPPORTED_PROVIDERS = new Set(["openai", "gemini"]);
const DEFAULT_PROVIDER = "openai";
const MAX_QUESTION_LENGTH = 1200;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.SEARCH_QUERY_RATE_LIMIT || 40);

const rateLimitStore = globalThis.__orthoSearchQueryRateLimit || new Map();
globalThis.__orthoSearchQueryRateLimit = rateLimitStore;

let openaiClient;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

const SEARCH_INSTRUCTIONS = [
  "You are a medical librarian specializing in orthopedic PubMed searches.",
  "Convert the user's Korean or English clinical research question into one PubMed search query.",
  "Use English biomedical terms, common synonyms, and PubMed field tags such as [Title/Abstract] and [MeSH Terms].",
  "Focus on title and abstract relevance. Do not add date filters or journal filters; the app applies those separately.",
  "Do not invent PMID values, author names, journal names, or article titles.",
  "Keep the query specific enough for an orthopedic literature scan, but not so narrow that it misses related abstracts.",
  "Return only valid JSON with this shape:",
  '{"pubmed_query":"string","concepts":["string"],"explanation":"string","confidence":"high|medium|low"}',
].join("\n");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function normalizeText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getClientId(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function checkRateLimit(req) {
  const clientId = getClientId(req);
  const now = Date.now();
  const record = rateLimitStore.get(clientId) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (record.resetAt <= now) {
    record.count = 0;
    record.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  record.count += 1;
  rateLimitStore.set(clientId, record);

  return {
    allowed: record.count <= RATE_LIMIT_MAX_REQUESTS,
    resetAt: record.resetAt,
  };
}

function normalizeProvider(value) {
  const provider = normalizeText(value).toLowerCase();
  return SUPPORTED_PROVIDERS.has(provider) ? provider : DEFAULT_PROVIDER;
}

function resolveAiConfig(body) {
  const provider = normalizeProvider(body.aiProvider);
  const userApiKey = normalizeText(body.aiApiKey);
  const requestedModel = normalizeText(body.aiModel);

  if (userApiKey) {
    return {
      provider,
      apiKey: userApiKey,
      model: requestedModel || (provider === "gemini" ? DEFAULT_GEMINI_MODEL : OPENAI_MODEL),
      source: "user",
    };
  }

  return {
    provider: DEFAULT_PROVIDER,
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || OPENAI_MODEL,
    source: "server",
  };
}

function buildSearchQueryInput({ question, journals, startDate, endDate }) {
  return [
    `Question: ${question}`,
    `Selected journals handled elsewhere: ${(journals || []).join(", ") || "N/A"}`,
    `Date range handled elsewhere: ${startDate || "N/A"} to ${endDate || "N/A"}`,
    "",
    "Build a PubMed query for the question only.",
    "Prefer Boolean groups using OR for synonyms and AND for concepts.",
    "Use [Title/Abstract] for specific anatomy, pathology, procedures, and outcomes.",
    "Use [MeSH Terms] only for broad established concepts where it helps recall.",
  ].join("\n");
}

function extractJsonText(rawText) {
  const text = String(rawText || "").trim();
  if (text.startsWith("{")) {
    return text;
  }
  return text.match(/\{[\s\S]*\}/)?.[0] || "";
}

function parseSearchQueryJson(rawText) {
  const jsonText = extractJsonText(rawText);
  if (!jsonText) {
    throw new Error("AI 응답에서 PubMed 검색식을 찾지 못했습니다.");
  }

  const parsed = JSON.parse(jsonText);
  const pubmedQuery = normalizeText(parsed.pubmed_query || parsed.pubmedQuery)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  if (!pubmedQuery) {
    throw new Error("AI가 빈 PubMed 검색식을 반환했습니다.");
  }

  return {
    pubmedQuery: pubmedQuery.slice(0, 1600),
    concepts: Array.isArray(parsed.concepts)
      ? parsed.concepts.slice(0, 8).map(normalizeText).filter(Boolean)
      : [],
    explanation: normalizeText(parsed.explanation),
    confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "medium",
  };
}

async function generateOpenAISearchQuery({ model, apiKey, input }) {
  const client = apiKey === process.env.OPENAI_API_KEY
    ? getOpenAIClient()
    : new OpenAI({ apiKey });

  const response = await client.responses.create({
    model,
    instructions: SEARCH_INSTRUCTIONS,
    input,
    max_output_tokens: 700,
  });

  return parseSearchQueryJson(response.output_text);
}

function readGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map(part => part.text || "").join("\n").trim();
}

async function generateGeminiSearchQuery({ model, apiKey, input }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SEARCH_INSTRUCTIONS }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: input }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 700,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = data?.error?.message || `${response.status} ${response.statusText}`;
    throw new Error(`Gemini API error: ${detail}`);
  }

  return parseSearchQueryJson(readGeminiText(data));
}

async function generateSearchQuery({ provider, model, apiKey, input }) {
  if (provider === "gemini") {
    return generateGeminiSearchQuery({ model, apiKey, input });
  }

  return generateOpenAISearchQuery({ model, apiKey, input });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, {
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: OPENAI_MODEL,
      promptVersion: SEARCH_PROMPT_VERSION,
      supportsUserApiKey: true,
      providers: Array.from(SUPPORTED_PROVIDERS),
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const limit = checkRateLimit(req);
  if (!limit.allowed) {
    return sendJson(res, 429, {
      error: "AI 검색 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      resetAt: new Date(limit.resetAt).toISOString(),
    });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    return sendJson(res, 400, { error: "요청 본문 JSON 형식이 올바르지 않습니다." });
  }

  const question = normalizeText(body.question).slice(0, MAX_QUESTION_LENGTH);
  const journals = Array.isArray(body.journals) ? body.journals.map(normalizeText).filter(Boolean).slice(0, 120) : [];
  const startDate = normalizeText(body.startDate);
  const endDate = normalizeText(body.endDate);
  const aiConfig = resolveAiConfig(body);

  if (!question) {
    return sendJson(res, 400, { error: "AI 검색 질문을 입력해주세요." });
  }

  if (!aiConfig.apiKey) {
    return sendJson(res, 400, {
      error: "설정 탭에서 OpenAI 또는 Gemini API 키를 입력해주세요.",
    });
  }

  if (!aiConfig.model) {
    return sendJson(res, 400, {
      error: "설정 탭에서 사용할 AI 모델을 선택해주세요.",
    });
  }

  try {
    const input = buildSearchQueryInput({ question, journals, startDate, endDate });
    const result = await generateSearchQuery({
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey: aiConfig.apiKey,
      input,
    });

    return sendJson(res, 200, {
      ...result,
      provider: aiConfig.provider,
      model: aiConfig.model,
      promptVersion: SEARCH_PROMPT_VERSION,
    });
  } catch (error) {
    console.error("AI search query error:", error);
    return sendJson(res, 500, {
      error: "AI 검색식 생성 중 오류가 발생했습니다.",
      detail: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
