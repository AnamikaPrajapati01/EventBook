import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { book, cancel, createEvent, createUser, getEvent, pool, resetDb } from './helpers.js';

beforeEach(resetDb);
after(() => pool.end());

describe('booking rules', () => {
  it('rejects a second booking of the same event, but allows it after cancelling', async () => {
    const user = await createUser();
    const eventId = await createEvent();

    const first = await book(user, eventId);
    assert.equal(first.status, 201);

    const again = await book(user, eventId);
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'ALREADY_BOOKED');

    assert.equal((await cancel(user, first.body.booking.id)).status, 200);
    assert.equal((await book(user, eventId)).status, 201);
  });

  it('never overbooks: a full event rejects further bookings', async () => {
    const eventId = await createEvent({ totalSeats: 2 });
    const [a, b, c] = [await createUser(), await createUser(), await createUser()];

    assert.equal((await book(a, eventId)).status, 201);
    assert.equal((await book(b, eventId)).status, 201);
    const res = await book(c, eventId);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'EVENT_FULL');
    assert.equal((await getEvent(eventId)).body.event.seatsLeft, 0);
  });

  it('gives the last seat to exactly one of several simultaneous bookers', async () => {
    const eventId = await createEvent({ totalSeats: 1 });
    const users = await Promise.all(Array.from({ length: 8 }, () => createUser()));

    const results = await Promise.all(users.map((u) => book(u, eventId)));

    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409, 409, 409, 409, 409, 409, 409]);
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM bookings WHERE event_id = $1 AND status = 'confirmed'`,
      [eventId],
    );
    assert.equal(rows[0].n, 1);
  });

  it('blocks booking a past event and cancelling a booking for a past event', async () => {
    const user = await createUser();
    const pastEvent = await createEvent({ daysFromNow: -2 });

    const res = await book(user, pastEvent);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'EVENT_PAST');

    // A booking that exists from before the event started (inserted directly).
    const { rows } = await pool.query(
      'INSERT INTO bookings (user_id, event_id) VALUES ($1, $2) RETURNING id',
      [user.id, pastEvent],
    );
    const cancelRes = await cancel(user, rows[0].id);
    assert.equal(cancelRes.status, 409);
    assert.equal(cancelRes.body.error.code, 'EVENT_PAST');
  });

  it('only lets users cancel their own bookings, and cancelling frees the seat', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const eventId = await createEvent({ totalSeats: 5 });
    const booking = (await book(owner, eventId)).body.booking;
    assert.equal((await getEvent(eventId)).body.event.seatsLeft, 4);

    const denied = await cancel(stranger, booking.id);
    assert.equal(denied.status, 403);
    assert.equal((await getEvent(eventId)).body.event.seatsLeft, 4);

    assert.equal((await cancel(owner, booking.id)).status, 200);
    assert.equal((await getEvent(eventId)).body.event.seatsLeft, 5);
  });
});
