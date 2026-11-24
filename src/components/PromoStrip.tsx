import Ext from "./Ext";
import { KLEROS_ABOUT, KLEROS_AI_URL, KLEROS_BUSINESS_URL } from "@/lib/kleros";

/** A short introduction to Kleros for visitors who don't know it yet. */
export default function PromoStrip({ lead = "New to Kleros?" }: { lead?: string }) {
  return (
    <aside className="promo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="promo-sym" src="/kleros-symbol.svg" alt="" aria-hidden />
      <div className="promo-text">
        <b>{lead}</b>
        <span>{KLEROS_ABOUT}</span>
      </div>
      <div className="promo-links">
        <a className="btn sm" href={KLEROS_AI_URL} target="_blank" rel="noopener">Kleros for AI agents<Ext /></a>
        <a className="btn sm" href={KLEROS_BUSINESS_URL} target="_blank" rel="noopener">For business<Ext /></a>
        <a className="btn sm" href="https://x.com/kleros_io" target="_blank" rel="noopener">Follow on X<Ext /></a>
      </div>
    </aside>
  );
}
