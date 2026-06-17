import OpenAI from "openai";

const DEFAULT_PROVIDER = "openai";
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const SUPPORTED_PROVIDERS = new Set(["openai", "gemini"]);

let openaiClient;

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

function createOpenAIClient(apiKey) {
  return apiKey === process.env.OPENAI_API_KEY
    ? getOpenAIClient()
    : new OpenAI({ apiKey });
}

function getClientId(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function checkRateLimit(req, rateLimitStore, { windowMs, maxRequests }) {
  const clientId = getClientId(req);
  const now = Date.now();
  const record = rateLimitStore.get(clientId) || { count: 0, resetAt: now + windowMs };

  if (record.resetAt <= now) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  record.count += 1;
  rateLimitStore.set(clientId, record);

  return {
    allowed: record.count <= maxRequests,
    resetAt: record.resetAt,
  };
}

function normalizeProvider(value) {
  const provider = normalizeText(value).toLowerCase();
  return SUPPORTED_PROVIDERS.has(provider) ? provider : DEFAULT_PROVIDER;
}

function resolveAiConfig(body, { openAiModel }) {
  const provider = normalizeProvider(body.aiProvider);
  const userApiKey = normalizeText(body.aiApiKey);
  const requestedModel = normalizeText(body.aiModel);

  if (userApiKey) {
    return {
      provider,
      apiKey: userApiKey,
      model: requestedModel || (provider === "gemini" ? DEFAULT_GEMINI_MODEL : openAiModel),
      source: "user",
    };
  }

  return {
    provider: DEFAULT_PROVIDER,
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || openAiModel,
    source: "server",
  };
}

function readGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map(part => part.text || "").join("\n").trim();
}

function extractJsonText(rawText) {
  const text = String(rawText || "").trim();
  if (text.startsWith("{")) {
    return text;
  }
  return text.match(/\{[\s\S]*\}/)?.[0] || "";
}

export {
  SUPPORTED_PROVIDERS,
  checkRateLimit,
  createOpenAIClient,
  extractJsonText,
  normalizeText,
  readGeminiText,
  resolveAiConfig,
  sendJson,
};
