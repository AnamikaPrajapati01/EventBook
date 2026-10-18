import Link from 'next/link';
import type { EventItem } from '@/lib/types';
import { dateParts } from '@/lib/format';
import { SeatMeter } from './SeatMeter';

export function EventCard({ event }: { event: EventItem }) {
  const { day, month, time } = dateParts(event.startsAt);
  return (
    <li>
      <Link href={`/events/${event.id}`} className={`ticket ticket--link${event.isPast ? ' ticket--past' : ''}`}>
        <div className="ticket__stub">
          <span className="ticket__day">{day}</span>
          <span className="ticket__month">{month}</span>
          <span className="ticket__time">{time}</span>
        </div>
        <div className="ticket__body">
          <h2 className="ticket__title">{event.title}</h2>
          <p className="ticket__venue">{event.venue}</p>
          <SeatMeter event={event} />
        </div>
      </Link>
    </li>
  );
}