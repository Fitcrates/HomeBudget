"use node";

import OpenAI from "openai";
import { sleep } from "./utils";

// Keep OCR responsive. A timed out vision call is already too slow for the scan flow,
// so callers can opt into a retry only where the extra latency is worth it.
const AI_CALL_TIMEOUT_MS = 25000;
const AI_CLIENT_TIMEOUT_MS = 35000;
const DEFAULT_MAX_ATTEMPTS = 2;
const GROQ_FALLBACK_TIMEOUT_MS = 22000;
const GROQ_FALLBACK_MAX_TOKENS = 8192;
const GROQ_VISION_MODEL =
  process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

let cachedGeminiClient: OpenAI | null = null;
let cachedGroqClient: OpenAI | null = null;

function getGemini() {
  if (cachedGeminiClient) return cachedGeminiClient;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Brak klucza API Gemini (GEMINI_API_KEY). Skonfiguruj go w ustawieniach Convex.");
  }

  cachedGeminiClient = new OpenAI({
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    apiKey,
    timeout: AI_CLIENT_TIMEOUT_MS,
    maxRetries: 0,
  });
  return cachedGeminiClient;
}

function getGroqFallback() {
  if (cachedGroqClient) return cachedGroqClient;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  cachedGroqClient = new OpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey,
    timeout: AI_CLIENT_TIMEOUT_MS,
    maxRetries: 0,
  });
  return cachedGroqClient;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`AI call timeout (${label}): ${timeoutMs}ms exceeded`)), timeoutMs)
    ),
  ]);
}

function extractStatusCode(error: any): number | null {
  const candidates = [
    error?.status,
    error?.statusCode,
    error?.response?.status,
    error?.cause?.status,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
}

function isRetriableError(error: any): boolean {
  const status = extractStatusCode(error);
  if (status !== null && [408, 409, 425, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("over capacity") ||
    message.includes("rate limit") ||
    message.includes("timeout") ||
    message.includes("temporar") ||
    message.includes("try again")
  );
}

function buildGroqFallbackRequest(
  request: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
  const requestedMaxTokens = typeof request.max_tokens === "number"
    ? request.max_tokens
    : GROQ_FALLBACK_MAX_TOKENS;

  return {
    ...request,
    model: GROQ_VISION_MODEL,
    max_tokens: Math.min(requestedMaxTokens, GROQ_FALLBACK_MAX_TOKENS),
  };
}

export async function createVisionCompletionWithRetry(
  request: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  label: string,
  retryOptions: number | {
    maxAttempts?: number;
    timeoutMs?: number;
    minTotalMs?: number;
    allowProviderFallback?: boolean;
  } = {}
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const maxAttempts = typeof retryOptions === "number"
    ? retryOptions
    : retryOptions.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const timeoutMs = typeof retryOptions === "number"
    ? AI_CALL_TIMEOUT_MS
    : retryOptions.timeoutMs ?? AI_CALL_TIMEOUT_MS;
  const minTotalMs = typeof retryOptions === "number"
    ? 0
    : retryOptions.minTotalMs ?? 0;
  const allowProviderFallback = typeof retryOptions === "number"
    ? true
    : retryOptions.allowProviderFallback ?? true;
  let lastError: unknown = null;
  const startedAt = Date.now();
  let attempt = 1;

  while (attempt <= maxAttempts || (Date.now() - startedAt < minTotalMs && isRetriableError(lastError))) {
    try {
      return await withTimeout(
        getGemini().chat.completions.create(request),
        timeoutMs,
        label
      );
    } catch (error: any) {
      lastError = error;
      const retriable = isRetriableError(error);
      const status = extractStatusCode(error);

      console.error(`Gemini OCR call failed (${label})`, {
        attempt,
        maxAttempts,
        status,
        message: String(error?.message || error),
        retriable,
      });

      const elapsedMs = Date.now() - startedAt;
      const shouldRetryForAttemptBudget = attempt < maxAttempts && (minTotalMs <= 0 || elapsedMs < minTotalMs);
      const shouldExtendForMinimumWindow = elapsedMs < minTotalMs && isRetriableError(error);
      if (!retriable || (!shouldRetryForAttemptBudget && !shouldExtendForMinimumWindow)) {
        break;
      }

      let delayMs = 800 * Math.pow(2, attempt - 1);
      const match = String(error?.message || "").match(/try again in ([\d.]+)s/);
      if (match && match[1]) {
        const requestedWaitMs = Math.ceil(parseFloat(match[1]) * 1000) + 500;
        if (!Number.isNaN(requestedWaitMs) && requestedWaitMs > delayMs) {
          delayMs = requestedWaitMs;
          console.log(`[OCR] Rate limit hit. Waiting ${delayMs}ms based on API hint.`);
        }
      }
      if (minTotalMs > 0) {
        const remainingMinimumWindowMs = Math.max(minTotalMs - elapsedMs, 250);
        delayMs = Math.min(delayMs, remainingMinimumWindowMs);
      }

      await sleep(delayMs);
      attempt += 1;
    }
  }

  const status = extractStatusCode(lastError);
  if (status === 503 || isRetriableError(lastError)) {
    const groqFallback = allowProviderFallback ? getGroqFallback() : null;
    if (groqFallback) {
      const fallbackRequest = buildGroqFallbackRequest(request);
      const fallbackTimeoutMs = Math.min(Math.max(timeoutMs, 12000), GROQ_FALLBACK_TIMEOUT_MS);

      console.warn(`Gemini unavailable for OCR (${label}); trying Groq fallback`, {
        model: fallbackRequest.model,
        timeoutMs: fallbackTimeoutMs,
      });

      try {
        return await withTimeout(
          groqFallback.chat.completions.create(fallbackRequest),
          fallbackTimeoutMs,
          `${label}:groq-fallback`
        );
      } catch (fallbackError: any) {
        console.error(`Groq OCR fallback failed (${label})`, {
          status: extractStatusCode(fallbackError),
          message: String(fallbackError?.message || fallbackError),
          retriable: isRetriableError(fallbackError),
        });
      }
    }

    throw new Error("Model OCR jest chwilowo przeciazony. Sprobuj ponownie za kilkanascie sekund.");
  }

  throw lastError;
}
