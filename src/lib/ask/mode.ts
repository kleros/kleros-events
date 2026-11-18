// Which kind of answer Ask gives. By default it is a smart search of the site (find.ts): no key,
// no AI and no cost. Claude, which is paid, answers only when switched on on purpose with
// ASK_PROVIDER=claude and an Anthropic key, so adding a key for talk summaries never starts billing
// for Ask.
export type AskMode = "claude" | "search";

const env = (k: string) => process.env[k]?.trim() || "";

export function askMode(): AskMode {
  const claude = !!(env("ASK_ANTHROPIC_API_KEY") || env("ANTHROPIC_API_KEY"));
  return env("ASK_PROVIDER").toLowerCase() === "claude" && claude ? "claude" : "search";
}
