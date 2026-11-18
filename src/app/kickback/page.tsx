import type { Metadata } from "next";
import { KICKBACK_URL } from "@/lib/kleros";
import Ext from "@/components/Ext";

export const metadata: Metadata = {
  title: "Kickback",
  description: "Run your own kickback event with Proof of Presence: guests put down a refundable deposit, and Kleros settles who came.",
};

/** Points visitors to Proof of Presence, the Kleros kickback app, so they can run their own kickback event. */
export default function KickbackPage() {
  return (
    <div className="wrap page kickback">
      <header className="page-head">
        <h1>Run your own kickback event</h1>
        <p className="lede">Guests book with a small refundable deposit and get it back when they show up. Fewer no-shows, and Kleros settles any dispute about who came.</p>
        <div className="row-flex actions">
          <a className="btn cta" href={`${KICKBACK_URL}/create.html`} target="_blank" rel="noopener">Create a kickback event<Ext /></a>
          <a className="btn" href={KICKBACK_URL} target="_blank" rel="noopener">Learn more<Ext /></a>
        </div>
      </header>

      <h2>How it works</h2>
      <ol className="kickback-steps">
        <li><b>Create the event.</b> Pick the deposit (ETH or any token), the dates and the number of spots. No sign-up or fee to Kleros.</li>
        <li><b>Guests book.</b> Paying the deposit books a spot. You can turn a guest away, and they get the full deposit back.</li>
        <li><b>Post who came.</b> After the event, you post the attendance list. Guests who came get their deposit back, and the deposits of no-shows are split among them.</li>
        <li><b>Kleros is the referee.</b> A guest left off the list can challenge it, and Kleros jurors decide.</li>
      </ol>
      <p className="muted small">Runs on Ethereum. Every event is its own contract with fixed rules: no one, Kleros included, can change them or move the deposits.</p>
    </div>
  );
}
