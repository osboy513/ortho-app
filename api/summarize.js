import crypto from "node:crypto";
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

const MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const PROMPT_VERSION = "ortho-summary-v2";
const MAX_ABSTRACT_LENGTH = 8000;
const CACHE_TTL_SECONDS = Number(process.env.SUMMARY_CACHE_TTL_SECONDS || 60 * 60 * 24 * 30);
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.SUMMARY_RATE_LIMIT || 30);

const memoryCache = globalThis.__orthoSummaryCache || new Map();
const rateLimitStore = globalThis.__orthoSummaryRateLimit || new Map();
globalThis.__orthoSummaryCache = memoryCache;
globalThis.__orthoSummaryRateLimit = rateLimitStore;

const SUMMARY_INSTRUCTIONS = [
  "You are an orthopedic research assistant.",
  "Summarize only from the provided PubMed title and abstract.",
  "Do not infer data, outcomes, indications, treatment recommendations, or evidence levels that are not explicitly present.",
  "Keep medical terms, anatomy, implants, devices, drugs, and study names in English.",
  "Write in Korean for Korean orthopedic clinicians.",
  "Return only valid JSON with this shape:",
  '{"clinical_relevance":"string","key_points":["string","string","string"],"limitations":"string","confidence":"high|medium|low"}',
].join("\n");

function truncateAbstract(abstract) {
  if (abstract.length <= MAX_ABSTRACT_LENGTH) {
    return abstract;
  }

  const cutPoint = abstract.lastIndexOf(" ", MAX_ABSTRACT_LENGTH);
  const safeCut = cutPoint > MAX_ABSTRACT_LENGTH * 0.6 ? cutPoint : MAX_ABSTRACT_LENGTH;
  return `${abstract.slice(0, safeCut).trim()}...`;
}

function buildProviderCacheKey({ provider, model, pmid, title, abstract }) {
  const source = pmid || `${title}\n${abstract}`;
  const digest = crypto.createHash("sha256").update(source).digest("hex");
  return `summary:${PROMPT_VERSION}:${provider}:${model}:${digest}`;
}

async function readRedisCache(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }

  const response = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (!data.result) {
    return null;
  }

  try {
    return JSON.parse(data.result);
  } catch {
    return null;
  }
}

async function writeRedisCache(key, value) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return;
  }

  await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}?EX=${CACHE_TTL_SECONDS}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

async function getCachedSummary(key) {
  const memoryEntry = memoryCache.get(key);
  if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
    return memoryEntry.value;
  }

  const redisEntry = await readRedisCache(key);
  if (redisEntry) {
    memoryCache.set(key, {
      value: redisEntry,
      expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    });
    return redisEntry;
  }

  return null;
}

async function setCachedSummary(key, value) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
  });
  await writeRedisCache(key, value);
}

function parseSummaryJson(rawText) {
  const text = String(rawText || "").trim();
  const jsonText = extractJsonText(rawText);

  if (!jsonText) {
    return {
      clinical_relevance: text || "요약 결과를 읽을 수 없습니다.",
      key_points: [],
      limitations: "모델 응답이 구조화된 JSON 형식이 아니었습니다.",
      confidence: "low",
    };
  }

  try {
    const parsed = JSON.parse(jsonText);
    return {
      clinical_relevance: normalizeText(parsed.clinical_relevance),
      key_points: Array.isArray(parsed.key_points)
        ? parsed.key_points.slice(0, 5).map(normalizeText).filter(Boolean)
        : [],
      limitations: normalizeText(parsed.limitations),
      confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "medium",
    };
  } catch {
    return {
      clinical_relevance: text || "요약 결과를 읽을 수 없습니다.",
      key_points: [],
      limitations: "모델 응답을 JSON으로 파싱하지 못했습니다.",
      confidence: "low",
    };
  }
}

function buildSummaryInput({ title, abstract, journalName, publicationDate, pmid }) {
  return [
    `PMID: ${pmid || "N/A"}`,
    `Title: ${title}`,
    `Journal: ${journalName || "N/A"}`,
    `Publication date: ${publicationDate || "N/A"}`,
    "",
    `Abstract: ${abstract}`,
  ].join("\n");
}

async function generateOpenAISummary({ model, apiKey, input }) {
  const client = createOpenAIClient(apiKey);

  const response = await client.responses.create({
    model,
    instructions: SUMMARY_INSTRUCTIONS,
    input,
    max_output_tokens: 900,
  });

  return parseSummaryJson(response.output_text);
}

async function generateGeminiSummary({ model, apiKey, input }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SUMMARY_INSTRUCTIONS }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: input }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 900,
        responseMimeType: "application/json"
      }
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = data?.error?.message || `${response.status} ${response.statusText}`;
    throw new Error(`Gemini API error: ${detail}`);
  }

  return parseSummaryJson(readGeminiText(data));
}

async function generateSummary({ provider, model, apiKey, title, abstract, journalName, publicationDate, pmid }) {
  const input = buildSummaryInput({ title, abstract, journalName, publicationDate, pmid });

  if (provider === "gemini") {
    return generateGeminiSummary({ model, apiKey, input });
  }

  return generateOpenAISummary({ model, apiKey, input });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, {
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      cache: process.env.UPSTASH_REDIS_REST_URL ? "upstash-redis" : "memory",
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
      error: "요약 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      resetAt: new Date(limit.resetAt).toISOString(),
    });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    return sendJson(res, 400, { error: "요청 본문 JSON 형식이 올바르지 않습니다." });
  }
  const pmid = normalizeText(body.pmid);
  const title = normalizeText(body.title);
  const journalName = normalizeText(body.journalName);
  const publicationDate = normalizeText(body.publicationDate);
  const abstract = truncateAbstract(normalizeText(body.abstract));
  const aiConfig = resolveAiConfig(body, { openAiModel: MODEL });

  if (!abstract || abstract === "No abstract information." || abstract === "초록 정보 없음.") {
    return sendJson(res, 400, { error: "초록 내용이 없어 요약할 수 없습니다." });
  }

  if (!title) {
    return sendJson(res, 400, { error: "논문 제목이 없어 요약할 수 없습니다." });
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
    const cacheKey = buildProviderCacheKey({
      provider: aiConfig.provider,
      model: aiConfig.model,
      pmid,
      title,
      abstract
    });
    const cachedSummary = await getCachedSummary(cacheKey);
    if (cachedSummary) {
      return sendJson(res, 200, {
        summary: cachedSummary,
        cached: true,
        provider: aiConfig.provider,
        model: aiConfig.model,
        promptVersion: PROMPT_VERSION,
      });
    }

    const summary = await generateSummary({
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey: aiConfig.apiKey,
      title,
      abstract,
      journalName,
      publicationDate,
      pmid
    });
    await setCachedSummary(cacheKey, summary);

    return sendJson(res, 200, {
      summary,
      cached: false,
      provider: aiConfig.provider,
      model: aiConfig.model,
      promptVersion: PROMPT_VERSION,
    });
  } catch (error) {
    console.error("Summary API error:", error);
    return sendJson(res, 500, {
      error: "AI 요약 생성 중 오류가 발생했습니다.",
      detail: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
