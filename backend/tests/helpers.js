// Must run before the app is imported: points the app at the test database.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
process.env.TEST_DATABASE_URL || 'postgresql://eventbook:eventbook@localhost:5432/eventbook_test';
process.env.DATABASE_SSL = 'false';
process.env.JWT_SECRET = 'test-secret';

const { readFile } = await import('node:fs/promises');
const bcrypt = (await import('bcryptjs')).default;
const { default: request } = await import('supertest');
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const { signToken } = await import('../src/middleware/auth.js');

export const app = createApp();
export { pool, request };

export async function resetDb() {
  await pool.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  await pool.query('TRUNCATE bookings, events, users CASCADE');
}

let counter = 0;
export async function createUser(role = 'user') {
  counter += 1;
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role`,
    [`Person ${counter}`, `person${counter}@test.dev`, bcrypt.hashSync('password123', 4), role],
  );
  return { ...rows[0], token: signToken(rows[0]) };
}

export async function createEvent({ totalSeats = 10, daysFromNow = 7, title = 'Test Event' } = {}) {
  const startsAt = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  const { rows } = await pool.query(
    `INSERT INTO events (title, description, starts_at, venue, total_seats)
     VALUES ($1, 'desc', $2, 'Venue', $3) RETURNING id`,
    [title, startsAt, totalSeats],
  );
  return rows[0].id;
}

export const as = (user) => ({ authorization: `Bearer ${user.token}` });
export const book = (user, eventId) =>
  request(app).post(`/api/events/${eventId}/bookings`).set(as(user));
export const cancel = (user, bookingId) =>
  request(app).post(`/api/bookings/${bookingId}/cancel`).set(as(user));
export const getEvent = (eventId) => request(app).get(`/api/events/${eventId}`);
