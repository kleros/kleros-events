/**
 * A PDF made of JPEG pictures, one per page, written by hand (no library): each page is the picture at its own
 * size. Used for the slides captured from a shared screen during an online call, so the saved recording is an
 * ordinary slide-synced talk.
 */
export async function jpegsToPdf(frames: { blob: Blob; w: number; h: number }[]): Promise<Blob> {
  const enc = new TextEncoder();
  const parts: BlobPart[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (p: Uint8Array | string) => { const b = typeof p === "string" ? enc.encode(p) : p; parts.push(b as Uint8Array<ArrayBuffer>); pos += b.length; };
  const obj = (n: number, body: string | Uint8Array[], dict?: string) => {
    offsets[n] = pos;
    if (typeof body === "string") { push(`${n} 0 obj\n${body}\nendobj\n`); return; }
    push(`${n} 0 obj\n${dict}\nstream\n`); body.forEach((b) => push(b)); push("\nendstream\nendobj\n");
  };
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const n = frames.length;
  // 1 catalog, 2 pages, then per page: page, image, content
  const pageIds = frames.map((_, i) => 3 + i * 3);
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Count ${n} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`);
  for (let i = 0; i < n; i++) {
    const { blob, w, h } = frames[i];
    const id = pageIds[i];
    const img = new Uint8Array(await blob.arrayBuffer());
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    obj(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`);
    obj(id + 1, [img], `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>`);
    obj(id + 2, [enc.encode(content)], `<< /Length ${enc.encode(content).length} >>`);
  }
  const total = 3 + n * 3;
  const xref = pos;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  push(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: "application/pdf" });
}
