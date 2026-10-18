export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

export function dateParts(iso: string) {
  const d = new Date(iso);
  return {
    day: d.getDate(),
    month: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(d),
    time: new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit' }).format(d),
  };
}

export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function seatsText(seatsLeft: number, isPast: boolean) {
  if (isPast) return 'Event has passed';
  if (seatsLeft === 0) return 'Sold out';
  if (seatsLeft === 1) return 'Only 1 seat left';
  return `${seatsLeft} seats left`;
}