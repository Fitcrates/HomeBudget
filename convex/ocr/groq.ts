"use node";

import OpenAI from "openai";
import { sleep } from "./utils";

// Keep OCR responsive. A timed out vision call is already too slow for the scan flow,
// so callers can opt into a retry only where the extra latency is worth it.
const AI_CALL_TIMEOUT_MS = 25000;
const AI_CLIENT_TIMEOUT_MS = 35000;
const DEFAULT_MAX_ATTEMPTS = 2;

let cachedGeminiClient: OpenAI | null = null;

function getGemini() {
  if (cachedGeminiClient) return cachedGeminiClient;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Brak klucza API Gemini (GEMINI_API_KEY). Skonfiguruj go w ustawieniach Convex.");
  }
  // Używamy warstwy kompatybilności OpenAI wdrożonej przez Google
  cachedGeminiClient = new OpenAI({
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    apiKey,
    timeout: AI_CLIENT_TIMEOUT_MS,
    maxRetries: 0, // We handle retries ourselves
  });
  return cachedGeminiClient;
}

// Wrapper to add timeout to any promise
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

export async function createVisionCompletionWithRetry(
  request: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  label: string,
  retryOptions: number | { maxAttempts?: number; timeoutMs?: number } = {}
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const maxAttempts = typeof retryOptions === "number"
    ? retryOptions
    : retryOptions.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const timeoutMs = typeof retryOptions === "number"
    ? AI_CALL_TIMEOUT_MS
    : retryOptions.timeoutMs ?? AI_CALL_TIMEOUT_MS;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Add timeout wrapper for each attempt
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

      if (!retriable || attempt === maxAttempts) {
        break;
      }

      let delayMs = 800 * Math.pow(2, attempt - 1);
      const match = String(error?.message || "").match(/try again in ([\d.]+)s/);
      if (match && match[1]) {
        const requestedWaitMs = Math.ceil(parseFloat(match[1]) * 1000) + 500;
        if (!isNaN(requestedWaitMs) && requestedWaitMs > delayMs) {
          delayMs = requestedWaitMs;
          console.log(`[OCR] Rate limit hit. Waiting ${delayMs}ms based on API hint.`);
        }
      }
      
      await sleep(delayMs);
    }
  }

  const status = extractStatusCode(lastError);
  if (status === 503 || isRetriableError(lastError)) {
    throw new Error("Model OCR jest chwilowo przeciążony. Spróbuj ponownie za kilkanaście sekund.");
  }

  throw lastError;
}
