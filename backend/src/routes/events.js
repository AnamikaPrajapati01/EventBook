import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { conflict, notFound } from '../errors.js';
import { optionalAuth, requireAdmin, requireAuth } from '../middleware/auth.js';
import { uuidParam, validate } from '../middleware/validate.js';
import { EVENT_SELECT, toEventDto } from '../events.js';
import { bookSeat } from '../bookings.js';

const router = Router();

const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  scope: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(9),
});

const eventFields = {
  title: z.string().trim().min(1, 'Title is required').max(150),
  description: z.string().trim().min(1, 'Description is required').max(5000),
  startsAt: z.iso.datetime({ offset: true, message: 'Use an ISO date-time, e.g. 2026-11-20T18:00:00+05:45' }),
  venue: z.string().trim().min(1, 'Venue is required').max(200),
  totalSeats: z.number().int('Seats must be a whole number').min(1, 'At least 1 seat').max(100000),
};

const createSchema = z.object(eventFields).refine((v) => new Date(v.startsAt) > new Date(), {
  path: ['startsAt'],
  message: 'A new event must start in the future',
});
const updateSchema = z.object(eventFields).partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Send at least one field to update',
});

// Escape LIKE wildcards so searching for "50%" matches literally.
const likePattern = (s) => `%${s.replace(/[\\%_]/g, '\\$&')}%`;

router.get('/', validate(listQuerySchema, 'query'), async (req, res) => {
  const { search, scope, page, pageSize } = req.valid.query;

  const where = [];
  const params = [];
  if (search) {
    params.push(likePattern(search));
    where.push(`e.title ILIKE $${params.length}`);
  }
  if (scope === 'upcoming') where.push('e.starts_at > now()');
  if (scope === 'past') where.push('e.starts_at <= now()');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const order = scope === 'upcoming' ? 'ASC' : 'DESC';

  // Pagination happens in SQL (LIMIT/OFFSET), not in the client.
  const [{ rows: countRows }, { rows }] = await Promise.all([
    pool.query(`SELECT count(*)::int AS total FROM events e ${whereSql}`, params),
    pool.query(
      `${EVENT_SELECT} ${whereSql} ORDER BY e.starts_at ${order}, e.id
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize],
    ),
  ]);

  const total = countRows[0].total;
  res.json({
    data: rows.map(toEventDto),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
});

router.get('/:id', uuidParam(), optionalAuth, async (req, res) => {
  const { rows } = await pool.query(`${EVENT_SELECT} WHERE e.id = $1`, [req.params.id]);
  if (!rows[0]) throw notFound('Event not found');

  const event = toEventDto(rows[0]);
  // Lets the UI show "Cancel my booking" instead of "Book" for the signed-in user.
  if (req.user) {
    const { rows: mine } = await pool.query(
      `SELECT id FROM bookings WHERE event_id = $1 AND user_id = $2 AND status = 'confirmed'`,
      [event.id, req.user.id],
    );
    event.myBookingId = mine[0]?.id ?? null;
  }
  res.json({ event });
});

router.post('/', requireAuth, requireAdmin, validate(createSchema), async (req, res) => {
  const { title, description, startsAt, venue, totalSeats } = req.valid.body;
  const { rows } = await pool.query(
    `INSERT INTO events (title, description, starts_at, venue, total_seats)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [title, description, startsAt, venue, totalSeats],
  );
  const { rows: created } = await pool.query(`${EVENT_SELECT} WHERE e.id = $1`, [rows[0].id]);
  res.status(201).json({ event: toEventDto(created[0]) });
});

router.patch('/:id', uuidParam(), requireAuth, requireAdmin, validate(updateSchema), async (req, res) => {
  const changes = req.valid.body;

  const event = await withTransaction(async (client) => {
    // Lock the event row: a concurrent booking waits, so the seat count we check can't change under us.
    const { rows } = await client.query('SELECT * FROM events WHERE id = $1 FOR UPDATE', [req.params.id]);
    const current = rows[0];
    if (!current) throw notFound('Event not found');

    if (changes.totalSeats !== undefined) {
      const { rows: counted } = await client.query(
        `SELECT count(*)::int AS booked FROM bookings WHERE event_id = $1 AND status = 'confirmed'`,
        [current.id],
      );
      if (changes.totalSeats < counted[0].booked) {
        throw conflict(
          'SEATS_BELOW_BOOKED',
          `Cannot reduce seats to ${changes.totalSeats}: ${counted[0].booked} seats are already booked`,
        );
      }
    }

    await client.query(
      `UPDATE events SET title = $2, description = $3, starts_at = $4, venue = $5,
                         total_seats = $6, updated_at = now()
       WHERE id = $1`,
      [
        current.id,
        changes.title ?? current.title,
        changes.description ?? current.description,
        changes.startsAt ?? current.starts_at,
        changes.venue ?? current.venue,
        changes.totalSeats ?? current.total_seats,
      ],
    );
    const { rows: updated } = await client.query(`${EVENT_SELECT} WHERE e.id = $1`, [current.id]);
    return updated[0];
  });

  res.json({ event: toEventDto(event) });
});

// Decision: an event with active bookings cannot be deleted (409). The admin must
// cancel/resolve those first, so nobody silently loses a seat they were promised.
router.delete('/:id', uuidParam(), requireAuth, requireAdmin, async (req, res) => {
  await withTransaction(async (client) => {
    const { rows } = await client.query('SELECT id FROM events WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!rows[0]) throw notFound('Event not found');

    const { rows: counted } = await client.query(
      `SELECT count(*)::int AS booked FROM bookings WHERE event_id = $1 AND status = 'confirmed'`,
      [req.params.id],
    );
    if (counted[0].booked > 0) {
      throw conflict(
        'EVENT_HAS_BOOKINGS',
        `Cannot delete: ${counted[0].booked} active booking(s) exist for this event`,
      );
    }
    // Only cancelled bookings (history) remain; they go with the event.
    await client.query('DELETE FROM bookings WHERE event_id = $1', [req.params.id]);
    await client.query('DELETE FROM events WHERE id = $1', [req.params.id]);
  });
  res.status(204).end();
});

router.get('/:id/bookings', uuidParam(), requireAuth, requireAdmin, async (req, res) => {
  const { rows: events } = await pool.query('SELECT id FROM events WHERE id = $1', [req.params.id]);
  if (!events[0]) throw notFound('Event not found');

  const { rows } = await pool.query(
    `SELECT b.id, b.created_at, u.id AS user_id, u.name, u.email
     FROM bookings b JOIN users u ON u.id = b.user_id
     WHERE b.event_id = $1 AND b.status = 'confirmed'
     ORDER BY b.created_at`,
    [req.params.id],
  );
  res.json({
    data: rows.map((r) => ({
      id: r.id,
      bookedAt: r.created_at,
      user: { id: r.user_id, name: r.name, email: r.email },
    })),
  });
});

router.post('/:id/bookings', uuidParam(), requireAuth, async (req, res) => {
  const booking = await bookSeat(req.params.id, req.user.id);
  res.status(201).json({ booking });
});

export default router;
