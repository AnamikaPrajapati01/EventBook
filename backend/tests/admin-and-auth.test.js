import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { app, as, book, createEvent, createUser, pool, request, resetDb } from './helpers.js';

beforeEach(resetDb);
after(() => pool.end());

describe('admin rules', () => {
  it('refuses to reduce seats below the number already booked', async () => {
    const admin = await createUser('admin');
    const eventId = await createEvent({ totalSeats: 5 });
    for (let i = 0; i < 3; i++) await book(await createUser(), eventId);

    const tooLow = await request(app).patch(`/api/events/${eventId}`).set(as(admin)).send({ totalSeats: 2 });
    assert.equal(tooLow.status, 409);
    assert.equal(tooLow.body.error.code, 'SEATS_BELOW_BOOKED');

    const exact = await request(app).patch(`/api/events/${eventId}`).set(as(admin)).send({ totalSeats: 3 });
    assert.equal(exact.status, 200);
    assert.equal(exact.body.event.seatsLeft, 0);
  });

  it('keeps event management and attendee lists admin-only', async () => {
    const user = await createUser();
    const eventId = await createEvent();
    const body = {
      title: 'X', description: 'Y', venue: 'Z', totalSeats: 5,
      startsAt: new Date(Date.now() + 86400000).toISOString(),
    };

    const calls = [
      () => request(app).post('/api/events').send(body),
      () => request(app).patch(`/api/events/${eventId}`).send({ title: 'Hacked' }),
      () => request(app).delete(`/api/events/${eventId}`),
      () => request(app).get(`/api/events/${eventId}/bookings`),
    ];
    for (const call of calls) {
      assert.equal((await call()).status, 401); // not logged in
      assert.equal((await call().set(as(user))).status, 403); // logged in, not admin
    }
  });

  it('does not delete an event that still has active bookings', async () => {
    const admin = await createUser('admin');
    const eventId = await createEvent();
    await book(await createUser(), eventId);

    const res = await request(app).delete(`/api/events/${eventId}`).set(as(admin));
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'EVENT_HAS_BOOKINGS');
  });
});

describe('auth', () => {
  it('hashes passwords and ignores a role sent at registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: 'sneaky@test.dev', password: 'password123', role: 'admin' });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'user');

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', ['sneaky@test.dev']);
    assert.notEqual(rows[0].password_hash, 'password123');
    assert.match(rows[0].password_hash, /^\$2[aby]\$/);
  });
});

describe('listing', () => {
  it('paginates and searches on the server', async () => {
    for (let i = 1; i <= 12; i++) await createEvent({ title: i <= 3 ? `Jazz ${i}` : `Talk ${i}`, daysFromNow: i });

    const page3 = await request(app).get('/api/events?page=3&pageSize=5');
    assert.equal(page3.body.data.length, 2);
    assert.deepEqual(page3.body.pagination, { page: 3, pageSize: 5, total: 12, totalPages: 3 });

    const search = await request(app).get('/api/events?search=jazz');
    assert.equal(search.body.pagination.total, 3);
  });
});
s