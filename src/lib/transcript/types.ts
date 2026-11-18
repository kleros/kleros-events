// Shapes shared by the transcript route, the talk page and the host console.

export type TranscriptStatus = "none" | "queued" | "transcribing" | "summarising" | "done" | "error";

export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface Chapter { t: number; title: string }
export interface Quote { t: number; text: string; speaker?: string }
export interface AudienceQuestion { t: number; question: string; answer?: string }
/** A task from a working meeting: what to do, who does it (when the recording makes it clear), by when. */
export interface ActionItem { t: number; task: string; owner?: string; due?: string }

export interface Summary {
  tldr: string;
  key_points: string[];
  chapters: Chapter[];
  quotes: Quote[];
  audience_questions?: AudienceQuestion[];
  action_items?: ActionItem[];
}

export interface TranscriptRow {
  material_id: string;
  status: TranscriptStatus;
  text: string | null;
  segments: Segment[];
  language: string | null;
  summary: Summary | null;
  error: string | null;
  provider: string | null;
  source: "audio" | "upload" | null;
  duration_seconds: number | null;
  started_at: string | null;
  updated_at: string;
}

/** What the route answers with, and what the panels show. */
export interface TranscriptState {
  status: TranscriptStatus;
  error?: string | null;
  /** true when a later call is needed to finish (the summary did not fit in this request) */
  more?: boolean;
  setup?: boolean;
}

export const BUSY: TranscriptStatus[] = ["queued", "transcribing", "summarising"];

/** Uploaded plain text without timestamps: times are estimates, so the UI does not offer seeking. */
export const isUntimed = (provider: string | null | undefined) => !!provider && provider.includes("untimed");

/** What the team reads while transcripts are off. NOT_SET_UP_DEV is folded away under it for a developer. */
export const NOT_SET_UP = "Transcripts are not switched on yet. A developer can turn them on.";
export const NOT_SET_UP_DEV =
  "Add GROQ_API_KEY (speech to text) and ANTHROPIC_API_KEY (summaries) to the site's environment variables (Netlify: Project configuration, Environment variables; Vercel: Settings, Environment Variables), then redeploy.";

/** The same while transcripts work but summaries are off. */
export const NO_SUMMARY = "Summaries are not switched on yet. A developer can turn them on.";
export const NO_SUMMARY_DEV =
  "Add ANTHROPIC_API_KEY to the site's environment variables (Netlify: Project configuration, Environment variables; Vercel: Settings, Environment Variables), then redeploy.";
