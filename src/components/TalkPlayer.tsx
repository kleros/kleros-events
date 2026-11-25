"use client";
import { useEffect, useState } from "react";
import TalkStage from "./TalkStage";
import { openPdf, type PdfDoc } from "@/lib/pdf";
import { retryMedia, trackPlaying } from "@/lib/mediaRetry";
import type { SlideMark } from "@/lib/types";

/** Slides with the recording. Nothing about the listener is stored (the site has no visitor accounts). */
export default function TalkPlayer({ pdfUrl, audioUrl, marks, notes }: {
  pdfUrl: string; audioUrl?: string; marks: SlideMark[]; notes: Record<string, string>;
}) {
  const [pdf, setPdf] = useState<PdfDoc | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => { openPdf(pdfUrl).then(setPdf).catch((e) => setErr(String(e?.message ?? e))); }, [pdfUrl]);

  // without the slides the recording still plays
  if (err) return (
    <>
      <div className="note">Couldn&apos;t load the slides. <a href={pdfUrl} target="_blank" rel="noopener">Open the PDF</a> instead.</div>
      {audioUrl && <audio ref={(n) => { if (n) trackPlaying(n); }} controls preload="metadata" src={audioUrl} style={{ width: "100%" }} onError={(e) => retryMedia(e.currentTarget)} />}
    </>
  );
  return (
    <TalkStage pdf={pdf} mode="play" audioUrl={audioUrl} marks={marks} notes={notes} />
  );
}
