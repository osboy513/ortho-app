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
const RANK_PROMPT_VERSION = "ortho-search-rank-v1";
const MAX_QUESTION_LENGTH = 1200;
const MAX_ARTICLES = 20;
const MAX_ABSTRACT_LENGTH = 1800;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.SEARCH_RANK_RATE_LIMIT || 60);

const rateLimitStore = globalThis.__orthoSearchRankRateLimit || new Map();
globalThis.__orthoSearchRankRateLimit = rateLimitStore;

const RANK_INSTRUCTIONS = [
  "You are an orthopedic research librarian.",
  "Rank candidate PubMed articles by how directly their title and abstract answer the user's research question.",
  "Base relevance only on the provided title and abstract. Do not use outside knowledge.",
  "Score 90-100 for direct evidence on the exact anatomy/pathology/mechanism/outcome in the question.",
  "Score 60-89 for closely related orthopedic evidence.",
  "Score 30-59 for partial or indirect relevance.",
  "Score 0-29 for weak relevance, wrong anatomy, wrong pathology, or no usable abstract.",
  "Return every provided PMID exactly once.",
  "Return only valid JSON with this shape:",
  '{"ranked_articles":[{"pmid":"string","score":0,"reason":"string","confidence":"high|medium|low"}]}',
].join("\n");

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeArticle(article) {
  const pmid = normalizeText(article?.pmid);
  const abstract = normalizeText(article?.abstract);

  return {
    pmid,
    title: normalizeText(article?.title).slice(0, 500),
    journalName: normalizeText(article?.journalName).slice(0, 160),
    publicationDate: normalizeText(article?.publicationDate).slice(0, 40),
    abstract: abstract.slice(0, MAX_ABSTRACT_LENGTH),
  };
}

function buildRankInput({ question, articles }) {
  return JSON.stringify({
    question,
    articles: articles.map(article => ({
      pmid: article.pmid,
      title: article.title,
      journal: article.journalName,
      publication_date: article.publicationDate,
      abstract: article.abstract,
    })),
  });
}

function parseRankJson(rawText, articles) {
  const allowedPmids = new Set(articles.map(article => article.pmid));
  const jsonText = extractJsonText(rawText);
  if (!jsonText) {
    throw new Error("AI 응답에서 관련도 랭킹을 찾지 못했습니다.");
  }

  const parsed = JSON.parse(jsonText);
  const ranked = Array.isArray(parsed.ranked_articles)
    ? parsed.ranked_articles
    : Array.isArray(parsed.rankedArticles)
      ? parsed.rankedArticles
      : [];

  const byPmid = new Map();

  ranked.forEach(item => {
    const pmid = normalizeText(item?.pmid);
    if (!pmid || !allowedPmids.has(pmid) || byPmid.has(pmid)) {
      return;
    }

    byPmid.set(pmid, {
      pmid,
      score: clampScore(item?.score),
      reason: normalizeText(item?.reason).slice(0, 280),
      confidence: ["high", "medium", "low"].includes(item?.confidence) ? item.confidence : "medium",
    });
  });

  articles.forEach(article => {
    if (!byPmid.has(article.pmid)) {
      byPmid.set(article.pmid, {
        pmid: article.pmid,
        score: 0,
        reason: "AI 랭킹 응답에 포함되지 않았습니다.",
        confidence: "low",
      });
    }
  });

  return Array.from(byPmid.values()).sort((a, b) => b.score - a.score);
}

async function generateOpenAIRank({ model, apiKey, input, articles }) {
  const client = createOpenAIClient(apiKey);

  const response = await client.responses.create({
    model,
    instructions: RANK_INSTRUCTIONS,
    input,
    max_output_tokens: 1700,
  });

  return parseRankJson(response.output_text, articles);
}

async function generateGeminiRank({ model, apiKey, input, articles }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: RANK_INSTRUCTIONS }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: input }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1700,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = data?.error?.message || `${response.status} ${response.statusText}`;
    throw new Error(`Gemini API error: ${detail}`);
  }

  return parseRankJson(readGeminiText(data), articles);
}

async function generateRank({ provider, model, apiKey, input, articles }) {
  if (provider === "gemini") {
    return generateGeminiRank({ model, apiKey, input, articles });
  }

  return generateOpenAIRank({ model, apiKey, input, articles });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, {
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: OPENAI_MODEL,
      promptVersion: RANK_PROMPT_VERSION,
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
      error: "AI 관련도 정렬 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
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
  const articles = Array.isArray(body.articles)
    ? body.articles.map(normalizeArticle).filter(article => article.pmid).slice(0, MAX_ARTICLES)
    : [];
  const aiConfig = resolveAiConfig(body, { openAiModel: OPENAI_MODEL });

  if (!question) {
    return sendJson(res, 400, { error: "AI 관련도 정렬 질문을 입력해주세요." });
  }

  if (articles.length === 0) {
    return sendJson(res, 400, { error: "관련도 정렬에 사용할 논문 목록이 없습니다." });
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
    const input = buildRankInput({ question, articles });
    const rankedArticles = await generateRank({
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey: aiConfig.apiKey,
      input,
      articles,
    });

    return sendJson(res, 200, {
      rankedArticles,
      provider: aiConfig.provider,
      model: aiConfig.model,
      promptVersion: RANK_PROMPT_VERSION,
    });
  } catch (error) {
    console.error("AI search rank error:", error);
    return sendJson(res, 500, {
      error: "AI 관련도 정렬 중 오류가 발생했습니다.",
      detail: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
