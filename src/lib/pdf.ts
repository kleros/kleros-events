"use client";
// pdf.js is loaded on demand so it never ships with pages that don't show slides.
type PdfJs = typeof import("pdfjs-dist");
let lib: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  if (!lib) {
    lib = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      return m;
    });
  }
  return lib;
}

export async function openPdf(src: string | ArrayBuffer) {
  const pdfjs = await loadPdfJs();
  // isEvalSupported: false keeps pdf.js from compiling font code with new Function, which the CSP forbids
  return pdfjs.getDocument({ ...(typeof src === "string" ? { url: src } : { data: new Uint8Array(src) }), isEvalSupported: false }).promise;
}
export type PdfDoc = Awaited<ReturnType<typeof openPdf>>;
