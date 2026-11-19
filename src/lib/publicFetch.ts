// Server-side fetch of an address that came from the database (an event poster, a recording given as a full URL),
// so from someone other than the deployment. Only http(s) on a host that resolves to a public address is fetched,
// every redirect is checked the same way before it is followed, and the body is read up to a byte limit. This keeps
// the server from being pointed at itself, the hosting platform's internal endpoints (169.254.169.254, the Lambda
// runtime API on 127.0.0.1) or the local network, and from reading a file without end into memory.
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(net, bits, "ipv4");
// ::/96 holds :: and ::1 and the old IPv4-compatible form. IPv4 written as IPv6 (::ffff:127.0.0.1) is judged by the
// IPv4 rules above: BlockList maps it (a ::ffff:0:0/96 rule here would match every IPv4 address)
for (const [net, bits] of [
  ["::", 96], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 23], ["2001:db8::", 32],
  ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(net, bits, "ipv6");

/** True for an IP address that is not on the public internet (loopback, private, link-local, metadata, …). */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return blocked.check(ip, "ipv4");
  if (v !== 6) return true;
  return blocked.check(ip, "ipv6");
}

export class UnsafeUrlError extends Error {}
export class TooLargeError extends Error {}

/** Throws UnsafeUrlError unless `raw` is http(s) on a public host (by name or address). */
export async function assertPublicUrl(raw: string | URL): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new UnsafeUrlError("Not a web address."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UnsafeUrlError("Only http and https addresses are fetched.");
  if (url.username || url.password) throw new UnsafeUrlError("Addresses with a user name or password are not fetched.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new UnsafeUrlError("That host is not on the public internet.");
  }
  let addresses: string[];
  if (isIP(host)) addresses = [host];
  else {
    try { addresses = (await lookup(host, { all: true, verbatim: true })).map((a) => a.address); }
    catch { throw new UnsafeUrlError("That host could not be found."); }
  }
  if (!addresses.length || addresses.some(isPrivateAddress)) throw new UnsafeUrlError("That host is not on the public internet.");
  return url;
}

interface Options {
  method?: "GET" | "HEAD";
  headers?: Record<string, string>;
  signal?: AbortSignal;
  maxRedirects?: number;
}

/** fetch() for an outside address: checked first, and again at every redirect (followed by hand, up to 5). */
export async function publicFetch(raw: string, opts: Options = {}): Promise<Response> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; ; hop++) {
    const r = await fetch(url, { method: opts.method ?? "GET", headers: opts.headers, signal: opts.signal, redirect: "manual", cache: "no-store" });
    const location = r.status >= 300 && r.status < 400 ? r.headers.get("location") : null;
    if (!location) return r;
    await r.body?.cancel().catch(() => {});
    if (hop >= (opts.maxRedirects ?? 5)) throw new UnsafeUrlError("Too many redirects.");
    url = await assertPublicUrl(new URL(location, url));
  }
}

/** The body of `r`, read up to `maxBytes`; throws TooLargeError past it (by Content-Length, or while reading). */
export async function readCapped(r: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(r.headers.get("content-length") ?? 0);
  if (declared > maxBytes) { await r.body?.cancel().catch(() => {}); throw new TooLargeError(`The file is larger than ${maxBytes} bytes.`); }
  if (!r.body) return new Uint8Array(await r.arrayBuffer());
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel().catch(() => {}); throw new TooLargeError(`The file is larger than ${maxBytes} bytes.`); }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.byteLength; }
  return out;
}
