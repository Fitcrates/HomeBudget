"use node";

import OpenAI from "openai";
import { sleep } from "./utils";

function getGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Brak klucza API Groq (GROQ_API_KEY). Skonfiguruj go w ustawieniach Convex.");
  }
  return new OpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey,
  });
}

function extractGroqStatusCode(error: any): number | null {
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

function isRetriableGroqError(error: any): boolean {
  const status = extractGroqStatusCode(error);
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

export async function createGroqCompletionWithRetry(
  request: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  label: string,
  maxAttempts = 4
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await getGroq().chat.completions.create(request);
    } catch (error: any) {
      lastError = error;
      const retriable = isRetriableGroqError(error);
      const status = extractGroqStatusCode(error);

      console.error(`Groq OCR call failed (${label})`, {
        attempt,
        maxAttempts,
        status,
        message: String(error?.message || error),
        retriable,
      });

      if (!retriable || attempt === maxAttempts) {
        break;
      }

      const delayMs = 1200 * Math.pow(2, attempt - 1);
      await sleep(delayMs);
    }
  }

  const status = extractGroqStatusCode(lastError);
  if (status === 503 || isRetriableGroqError(lastError)) {
    throw new Error("Model OCR jest chwilowo przeciążony. Spróbuj ponownie za kilkanaście sekund.");
  }

  throw lastError;
}
