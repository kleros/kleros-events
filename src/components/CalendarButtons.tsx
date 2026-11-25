const CalIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);

/**
 * An upcoming event's Add to calendar: Google Calendar, plus an .ics file for Apple Calendar or Outlook.
 * Nothing is stored: the site has no visitor accounts.
 */
export default function CalendarButtons({ slug, calendarUrl }: { slug: string; calendarUrl: string }) {
  return (
    <span className="cal-pair">
      <a className="btn ghost act" href={calendarUrl} target="_blank" rel="noopener"><CalIcon /><span>Add to calendar</span></a>
      <a className="cal-ics" href={`/events/${slug}/calendar.ics`} title="For Apple Calendar or Outlook">.ics</a>
    </span>
  );
}
