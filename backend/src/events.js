
export const EVENT_SELECT = `
  SELECT e.id, e.title, e.description, e.starts_at, e.venue, e.total_seats,
         (SELECT count(*) FROM bookings b
           WHERE b.event_id = e.id AND b.status = 'confirmed')::int AS booked_count
  FROM events e`;

export function toEventDto(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    venue: row.venue,
    totalSeats: row.total_seats,
    seatsLeft: row.total_seats - row.booked_count,
    isPast: new Date(row.starts_at) <= new Date(),
  };
}
