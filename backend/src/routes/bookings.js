import { Router } from 'express';
import { pool } from '../db.js';
import { conflict, forbidden, notFound } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { uuidParam } from '../middleware/validate.js';

const router = Router();

router.use(requireAuth);

router.get('/mine', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.id, b.status, b.created_at, b.cancelled_at,
            e.id AS event_id, e.title, e.starts_at, e.venue
     FROM bookings b JOIN events e ON e.id = b.event_id
     WHERE b.user_id = $1
     ORDER BY (b.status = 'confirmed') DESC, e.starts_at DESC`,
    [req.user.id],
  );
  res.json({
    data: rows.map((r) => ({
      id: r.id,
      status: r.status,
      bookedAt: r.created_at,
      cancelledAt: r.cancelled_at,
      event: {
        id: r.event_id,
        title: r.title,
        startsAt: r.starts_at,
        venue: r.venue,
        isPast: new Date(r.starts_at) <= new Date(),
      },
    })),
  });
});

router.post('/:id/cancel', uuidParam(), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.id, b.user_id, b.status, e.starts_at
     FROM bookings b JOIN events e ON e.id = b.event_id
     WHERE b.id = $1`,
    [req.params.id],
  );
  const booking = rows[0];
  if (!booking) throw notFound('Booking not found');
  if (booking.user_id !== req.user.id) throw forbidden('You can only cancel your own bookings');
  if (booking.status === 'cancelled') throw conflict('ALREADY_CANCELLED', 'This booking is already cancelled');
  if (new Date(booking.starts_at) <= new Date()) {
    throw conflict('EVENT_PAST', 'This event has already started, so the booking can no longer be cancelled');
  }

  // The status guard makes a double-click or retry harmless: only one request can flip it.
  const { rows: updated } = await pool.query(
    `UPDATE bookings SET status = 'cancelled', cancelled_at = now()
     WHERE id = $1 AND status = 'confirmed'
     RETURNING id, status, cancelled_at`,
    [booking.id],
  );
  if (!updated[0]) throw conflict('ALREADY_CANCELLED', 'This booking is already cancelled');

  res.json({ booking: { id: updated[0].id, status: updated[0].status, cancelledAt: updated[0].cancelled_at } });
});

export default router;
