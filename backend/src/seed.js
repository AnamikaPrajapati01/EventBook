import bcrypt from 'bcryptjs';
import { pool, withTransaction } from './db.js';

const reset = process.argv.includes('--reset');

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Set it in backend/.env before seeding.`);
    process.exit(1);
  }
  return value;
}

const admin = {
  name: 'Admin',
  email: required('SEED_ADMIN_EMAIL').toLowerCase(),
  password: required('SEED_ADMIN_PASSWORD'),
  role: 'admin',
};
const testUser = {
  name: 'Test User',
  email: required('SEED_USER_EMAIL').toLowerCase(),
  password: required('SEED_USER_PASSWORD'),
  role: 'user',
};
const attendeePassword = required('SEED_ATTENDEE_PASSWORD');
const attendees = ['Asha', 'Bikash', 'Chandra', 'Dipa', 'Eshan'].map((n) => ({
  name: n,
  email: `${n.toLowerCase()}@eventbook.test`,
  password: attendeePassword,
  role: 'user',
}));

const DAY = 24 * 60 * 60 * 1000;
const inDays = (d, hour = 18) => {
  const date = new Date(Date.now() + d * DAY);
  date.setUTCHours(hour - 6, 0, 0, 0); // roughly evening in Nepal time
  return date.toISOString();
};

const topics = [
  ['Intro to React Workshop', 'Hands-on basics of components and state.', 'Patan Tech Hub', 40],
  ['Node.js Meetup', 'Lightning talks and networking for backend developers.', 'Thamel Co-working', 60],
  ['Acoustic Night', 'An evening of live acoustic music.', 'Jazz Upstairs, Lazimpat', 80],
  ['Product Design Sprint', 'A one-day sprint from problem to prototype.', 'Kupondole Studio', 25],
  ['Postgres Deep Dive', 'Indexes, transactions and query plans explained.', 'Patan Tech Hub', 35],
  ['Photography Walk', 'Golden-hour street photography around Bhaktapur.', 'Bhaktapur Durbar Square', 20],
  ['Startup Pitch Night', 'Five early-stage teams pitch to local investors.', 'Bluebird Auditorium', 120],
  ['Python for Data Workshop', 'Pandas and plotting from scratch.', 'Baneshwor Learning Lab', 30],
  ['Open Mic Evening', 'Poetry, stories and stand-up. Everyone welcome.', 'Café Soma, Jhamsikhel', 50],
  ['DevOps Basics', 'Docker, CI and deploying your first service.', 'Thamel Co-working', 45],
  ['Women in Tech Panel', 'Career stories and Q&A with engineers.', 'Hotel Annapurna Hall', 150],
  ['Mobile UX Clinic', 'Bring your app for live design feedback.', 'Kupondole Studio', 20],
  ['Board Games Social', 'Casual evening of board games and snacks.', 'Dhokaima Café', 36],
  ['Rock Concert: Himalayan Echo', 'Live rock night with three local bands.', 'Dasrath Stadium Ground', 500],
  ['Cybersecurity 101', 'How attacks work and how to stay safe online.', 'Baneshwor Learning Lab', 70],
  ['Yoga in the Park', 'Beginner-friendly morning session.', 'Ratna Park', 30],
  ['AI Tools for Developers', 'Using AI assistants responsibly in real projects.', 'Patan Tech Hub', 90],
  ['Film Screening: Short Films', 'A curated set of Nepali short films.', 'Kumari Cinema Hall', 100],
  ['Hackathon Kickoff', 'Form teams and pick your challenge.', 'Thamel Co-working', 80],
  ['Cooking Class: Newari Cuisine', 'Learn to cook classic Newari dishes.', 'Kirtipur Kitchen', 15],
  ['TypeScript Study Group', 'Working through generics together.', 'Café Soma, Jhamsikhel', 25],
  ['Charity Run 5K', 'A fun run supporting local schools.', 'Tribhuvan University Ground', 300],
];

async function upsertUser(client, u) {
  const hash = await bcrypt.hash(u.password, 10);
  const { rows } = await client.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT (lower(email)) DO UPDATE
       SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
     RETURNING id`,
    [u.name, u.email, hash, u.role],
  );
  return rows[0].id;
}

async function addEvent(client, { title, description, venue, seats, startsAt }) {
  const { rows } = await client.query(
    `INSERT INTO events (title, description, venue, total_seats, starts_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [title, description, venue, seats, startsAt],
  );
  return rows[0].id;
}

const book = (client, userId, eventId) =>
  client.query('INSERT INTO bookings (user_id, event_id) VALUES ($1, $2)', [userId, eventId]);

await withTransaction(async (client) => {
  await upsertUser(client, admin);
  const testUserId = await upsertUser(client, testUser);
  const attendeeIds = [];
  for (const a of attendees) attendeeIds.push(await upsertUser(client, a));

  if (reset) await client.query('TRUNCATE bookings, events CASCADE');
  const { rows } = await client.query('SELECT count(*)::int AS n FROM events');
  if (rows[0].n > 0) {
    console.log('Events already exist; skipped sample events (use --reset to recreate).');
    return;
  }

  // 22 upcoming events: enough for several pages.
  for (const [i, [title, description, venue, seats]] of topics.entries()) {
    await addEvent(client, { title, description, venue, seats, startsAt: inDays(3 + i * 2, 10 + (i % 8)) });
  }

  // Edge-case events for testing the rules.
  const nearlyFull = await addEvent(client, {
    title: 'Nearly Full: Chess Masterclass',
    description: 'Only one seat left. Good for testing the last-seat race.',
    venue: 'Thamel Chess Club', seats: 3, startsAt: inDays(5),
  });
  await book(client, attendeeIds[0], nearlyFull);
  await book(client, attendeeIds[1], nearlyFull);

  const soldOut = await addEvent(client, {
    title: 'Sold Out: Jazz Trio Evening',
    description: 'Every seat is taken. Booking should fail with "event is full".',
    venue: 'Jazz Upstairs, Lazimpat', seats: 2, startsAt: inDays(6),
  });
  await book(client, attendeeIds[2], soldOut);
  await book(client, attendeeIds[3], soldOut);

  const past = await addEvent(client, {
    title: 'Past Event: Web Dev Meetup',
    description: 'Already happened. It cannot be booked and its bookings cannot be cancelled.',
    venue: 'Patan Tech Hub', seats: 30, startsAt: inDays(-7),
  });
  await book(client, testUserId, past);
  await book(client, attendeeIds[4], past);

  console.log(`Seeded ${topics.length + 3} events.`);
});

console.log(`Users ready: ${admin.email} (admin), ${testUser.email} (user)`);
await pool.end();
