/**
 * Password-reset webhook - Google Apps Script owned by the project
 * Owner ("Brialyns Art Sign" script).
 *
 * Why this exists: Google currently blocks all email-template/action-URL
 * updates (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`), so Firebase's reset
 * email can only link to its own `firebaseapp.com/__/auth/action`
 * widget. Instead, this web app asks the script for a reset link:
 *   1. POST { email, secret } to the Apps Script web app.
 *   2. The script mints a service-account token, calls the Identity
 *      Toolkit Admin API (`returnOobLink: true`) and extracts the
 *      one-time code.
 *   3. The script emails a BRANDED message through Gmail whose link
 *      points straight at `/reset-password?mode=resetPassword&oobCode=...`.
 *
 * `text/plain` is deliberate: it keeps the request a "simple" CORS
 * request (no preflight). Apps Script answers with
 * `Access-Control-Allow-Origin: *`, so the JSON body stays readable.
 */
const WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbwHoTUX9sPSS6cK0Z3URJdzyJveDCOSMSBOaDEx9NvHXuz4vMSTKsZvSEPzPbdkenM/exec";

/**
 * Shared secret with the Apps Script. Not a hard security boundary
 * (this static bundle is public) - it stops casual abuse of the
 * webhook URL. The script itself only sends reset emails for
 * addresses that exist, and reset codes are single-use.
 */
const WEBHOOK_SECRET = "QlMCpL7iBOIHgtu5wCp84nY9muJvMTr";

interface WebhookResponse {
  ok?: boolean;
  error?: string;
}

interface WebhookReply {
  /** Parsed JSON body, or null when the reply was not valid JSON. */
  data: WebhookResponse | null;
  /** False on network failure / non-2xx (e.g. Apps Script cold-start page). */
  reachable: boolean;
}

async function postReset(email: string, name: string): Promise<WebhookReply> {
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ email, name, secret: WEBHOOK_SECRET }),
    });
    if (!res.ok) return { data: null, reachable: false };
    try {
      return { data: (await res.json()) as WebhookResponse, reachable: true };
    } catch {
      return { data: null, reachable: false };
    }
  } catch {
    return { data: null, reachable: false };
  }
}

/**
 * Asks the Apps Script webhook to email a branded reset link to
 * `email`. Resolves when the script confirms it sent the message;
 * throws with a human-readable message otherwise.
 *
 * `name` is the requester's full name from the users collection - the
 * script uses it to personalise the email greeting ("Hi Jena,").
 */
export async function requestPasswordReset(
  email: string,
  name?: string,
): Promise<void> {
  const safeName = (name ?? "").trim().slice(0, 80);
  let reply = await postReset(email, safeName);

  // Apps Script cold starts occasionally answer with a transient error
  // page instead of JSON. One retry after a short pause keeps the flow
  // reliable; a genuine send failure returns valid JSON immediately and
  // is NOT retried (avoids duplicate emails).
  if (!reply.reachable) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    reply = await postReset(email, safeName);
    if (!reply.reachable) {
      throw new Error(
        "Could not reach the reset service. Check your connection and try again.",
      );
    }
  }

  const data = reply.data;
  if (!data?.ok) {
    throw new Error(
      data?.error
        ? `Reset service error (${data.error}). Try again in a moment.`
        : "Could not send the reset email. Try again in a moment.",
    );
  }
}
