import type { EventItem } from '@/lib/types';
import { seatsText } from '@/lib/format';

export function SeatMeter({ event }: { event: Pick<EventItem, 'seatsLeft' | 'totalSeats' | 'isPast'> }) {
  const booked = event.totalSeats - event.seatsLeft;
  const percent = Math.round((booked / event.totalSeats) * 100);
  const state = event.isPast ? '' : event.seatsLeft === 0 ? 'seats--full' : event.seatsLeft <= Math.max(3, event.totalSeats * 0.15) ? 'seats--low' : '';
  return (
    <div className={`seats ${state}`}>
      <span className="seats__text">{seatsText(event.seatsLeft, event.isPast)}</span>
      <div className="seats__bar" role="img" aria-label={`${booked} of ${event.totalSeats} seats booked`}>
        <div className="seats__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}