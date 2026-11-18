import type { ShareArt } from "./share";

/** Pixel size and type of a PNG, GIF or JPEG from its first bytes; null for anything else (satori draws only these). */
export function imageInfo(b: Buffer): { mime: string; width: number; height: number } | null {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { mime: "image/png", width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length > 10 && b.toString("ascii", 0, 4) === "GIF8") return { mime: "image/gif", width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      if (marker === 0xff) { i++; continue; }
      // start of frame (any kind but DHT, JPG and DAC, which share the range)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { mime: "image/jpeg", width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

const MAX_BYTES = 3_000_000;
/**
 * The event's poster as a data URL, or null when it can't be had quickly: slow host, too big, or a format satori
 * can't draw (WebP, AVIF). The share image is then drawn without it, never broken. Only public names, never an
 * address or a local host.
 */
export async function fetchArt(url: string | null): Promise<ShareArt | null> {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":") || host.endsWith(".local") || host.endsWith(".internal")) return null;
    const r = await fetch(url, { signal: AbortSignal.timeout(3500), cache: "no-store", headers: { accept: "image/png,image/jpeg,image/gif;q=0.9" } });
    if (!r.ok || Number(r.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) return null;
    const info = imageInfo(buf);
    if (!info || info.width < 64 || info.height < 64) return null;
    return { src: `data:${info.mime};base64,${buf.toString("base64")}`, width: info.width, height: info.height };
  } catch {
    return null;
  }
}
