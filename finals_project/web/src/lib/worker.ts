/**
 * Cloudflare Worker base URL — the privacy proxy for the AI chat and the
 * Turnstile human-verification endpoint. The secrets (OpenRouter key,
 * Turnstile secret) live ONLY in the Worker; the browser never sees them.
 */
export const WORKER_BASE_URL =
  process.env.NEXT_PUBLIC_AI_CHAT_URL ??
  "https://brialyns-ai-chat.lancebradly00.workers.dev";
