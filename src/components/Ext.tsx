/** Marks a link that opens in a new tab: an arrow for the eye, the words for a screen reader. */
export default function Ext() {
  return <><span aria-hidden="true"> ↗</span><span className="sr-only"> (opens in a new tab)</span></>;
}
