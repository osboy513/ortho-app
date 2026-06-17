import {
  SUPPORTED_PROVIDERS,
  checkRateLimit,
  createOpenAIClient,
  extractJsonText,
  normalizeText,
  readGeminiText,
  resolveAiConfig,
  sendJson,
} from "../server/ai_common.js";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const SEARCH_PROMPT_VERSION = "ortho-search-query-v1";
const MAX_QUESTION_LENGTH = 1200;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.SEARCH_QUERY_RATE_LIMIT || 40);

const rateLimitStore = globalThis.__orthoSearchQueryRateLimit || new Map();
globalThis.__orthoSearchQueryRateLimit = rateLimitStore;

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
  const client = createOpenAIClient(apiKey);

  const response = await client.responses.create({
    model,
    instructions: SEARCH_INSTRUCTIONS,
    input,
    max_output_tokens: 700,
  });

  return parseSearchQueryJson(response.output_text);
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

  const limit = checkRateLimit(req, rateLimitStore, {
    windowMs: RATE_LIMIT_WINDOW_MS,
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
  });
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
  const aiConfig = resolveAiConfig(body, { openAiModel: OPENAI_MODEL });

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
