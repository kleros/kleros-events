import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The share images read their fonts from disk at request time. next.config.ts lists them in outputFileTracingIncludes
// so the server bundle on Vercel and Netlify ships them. satori reads TTF or OTF only, no woff2, no variable fonts.
const FONT_DIR = join(process.cwd(), "src/lib/cover/fonts");
export type ShareFont = { name: string; data: Buffer; weight: 400 | 500; style: "normal" | "italic" };
let fonts: Promise<ShareFont[]> | undefined;
export function loadShareFonts(): Promise<ShareFont[]> {
  fonts ??= Promise.all([
    readFile(join(FONT_DIR, "InstrumentSerif-Regular.ttf")),
    readFile(join(FONT_DIR, "Geist-Regular.ttf")),
    readFile(join(FONT_DIR, "Geist-Medium.ttf")),
  ]).then(([serif, sans, sansMedium]): ShareFont[] => [
    { name: "Instrument Serif", data: serif, weight: 400, style: "normal" },
    { name: "Geist", data: sans, weight: 400, style: "normal" },
    { name: "Geist", data: sansMedium, weight: 500, style: "normal" },
  ]).catch((err) => { fonts = undefined; throw err; });
  return fonts;
}
