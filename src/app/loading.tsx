// Shown at once when a link is clicked, while the next page is on its way (pages built per visit, such as
// an event or a talk, take a moment). Quiet on purpose: a thin bar under the header and a soft outline.
export default function Loading() {
  return (
    <div className="wrap page page-loading" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="page-loading-bar" aria-hidden="true" />
      <div className="page-loading-block wide" aria-hidden="true" />
      <div className="page-loading-block" aria-hidden="true" />
      <div className="page-loading-block short" aria-hidden="true" />
    </div>
  );
}
