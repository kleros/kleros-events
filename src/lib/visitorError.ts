import { friendlyError, NO_ACCESS } from "./friendlyError";

/**
 * Plain words for visitors' own forms (meeting requests, saving an event, a display name).
 * Same mapping as the team's tools, without the team wording or the "send Wei Wei this" fallback.
 */
export function visitorError(raw: unknown, what = "That"): string {
  const m = friendlyError(raw);
  if (m === NO_ACCESS) return "This browser's sign-in has run out. Reload the page and try again.";
  if (m.startsWith("Something went wrong")) {
    console.warn(raw);
    return `${what} did not go through. Try again in a moment.`;
  }
  return m;
}
