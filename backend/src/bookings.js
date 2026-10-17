import { withTransaction } from './db.js';
import { conflict, notFound } from './errors.js';

// Books one seat. All rules are checked inside one transaction while holding a
// row lock on the event, so two people racing for the last seat are serialised:
// the second one sees the seat already taken and gets EVENT_FULL.
export async function bookSeat(eventId, userId) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT id, starts_at, total_seats FROM events WHERE id = $1 FOR UPDATE',
      [eventId],
    );
    const event = rows[0];
    if (!event) throw notFound('Event not found');

    if (new Date(event.starts_at) <= new Date()) {
      throw conflict('EVENT_PAST', 'This event has already started, so it can no longer be booked');
    }

    const { rows: existing } = await client.query(
      `SELECT 1 FROM bookings WHERE event_id = $1 AND user_id = $2 AND status = 'confirmed'`,
      [eventId, userId],
    );
    if (existing[0]) throw conflict('ALREADY_BOOKED', 'You have already booked this event');

    const { rows: counted } = await client.query(
      `SELECT count(*)::int AS booked FROM bookings WHERE event_id = $1 AND status = 'confirmed'`,
      [eventId],
    );
    if (counted[0].booked >= event.total_seats) throw conflict('EVENT_FULL', 'This event is full');

    // The partial unique index is the last line of defence for "no double booking".
    const { rows: created } = await client.query(
      `INSERT INTO bookings (user_id, event_id) VALUES ($1, $2)
       RETURNING id, event_id, status, created_at`,
      [userId, eventId],
    );
    return toBookingDto(created[0]);
  });
}

export function toBookingDto(row) {
  return { id: row.id, eventId: row.event_id, status: row.status, bookedAt: row.created_at };
}
