# EventBook

An event booking app. An admin publishes events with a fixed number of seats; visitors browse and search them; registered users book and cancel seats. The backend enforces every booking rule, so the rules hold even when the API is called directly with Postman or curl. The frontend only shows the data and calls the API.

**Status:** backend and frontend complete and tested locally.

The API runs on a free Render instance, so the first request after a period of inactivity can take up to a minute while it wakes up. The frontend shows a "Cannot reach the server" message with a retry button in that case.

## Features

- Browse upcoming events without an account, with title search and server-side pagination.
- Register and log in. Passwords are hashed; login uses a signed token.
- Book one seat per event, and cancel your own bookings. A "My bookings" page lists them.
- Admins create, edit and delete events and see the attendee list for each event.
- Every page has loading, error and empty states.

## Tech stack and why

- **Frontend:** Next.js (App Router) + TypeScript, plain CSS. It only renders pages and calls the REST API: there are no Next.js API routes, server actions or direct Supabase calls in it.
- **Backend:** Node.js + Express, using the `pg` driver with hand-written SQL. With only three tables, plain SQL keeps every query and transaction visible, which matters most for the booking rules.
- **Database:** PostgreSQL on Supabase. Only the backend connects to it.
- **Auth:** built in the backend: passwords hashed with bcrypt, login tokens are JWTs.
- **Validation:** zod checks every request body and query string before a route runs.
- **Tests:** Node's built-in test runner and supertest, against a real Postgres database.

## Project structure

```
eventbook/
  backend/
    db/schema.sql          tables and constraints
    src/
      config.js            reads .env
      db.js                database connection and transaction helper
      app.js, server.js    Express app and server start
      migrate.js, seed.js  create tables, add sample data
      bookings.js          the booking transaction (seat rules)
      events.js            event query and response shape
      middleware/          auth, validation, error handling
      routes/              auth.js, events.js, bookings.js
    tests/                 automated tests
  frontend/
    app/                   pages (home, event detail, login, register, bookings, admin)
    components/            header, event card, seat meter, pagination, event form, loading/error states
    lib/                   API client, login state, types, helpers
```

## Run it locally

Requires Node 20 or newer and a PostgreSQL database (a Supabase project works).

### Backend

```bash
cd backend
npm install
cp .env.example .env     # Windows: copy .env.example .env
# edit .env (see the table below)
npm run migrate          # creates the tables; safe to run again
npm run seed             # admin, test user and sample events
npm run dev              # http://localhost:4000
```

Check it works: open `http://localhost:4000/api/health`. You should see `{"status":"ok"}`.

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | Postgres connection string. For Supabase use the **Session pooler** string, because the direct connection needs IPv6. |
| `DATABASE_SSL` | `true` for Supabase, `false` for a local Postgres. |
| `JWT_SECRET` | Long random text used to sign login tokens. Never commit it. |
| `CORS_ORIGINS` | Comma-separated list of frontend addresses allowed to call the API (for example `http://localhost:3000`). |
| `PORT` | Port for the API (default 4000). |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_USER_EMAIL`, `SEED_USER_PASSWORD` | Optional. Used only by `npm run seed`. |

Put quotes around any value containing `#`, for example `SEED_USER_PASSWORD="User#12345"`. In a `.env` file an unquoted `#` starts a comment and cuts the value short.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm run dev                  # http://localhost:3000
```

`.env.local` has one setting: `NEXT_PUBLIC_API_URL`, the address of the backend (for example `http://localhost:4000`). Anything starting with `NEXT_PUBLIC_` is visible in the browser, so no secrets go there.

### Seed data

`npm run seed` always creates or updates the admin and the test user. It adds sample events only when there are none: 22 upcoming events (enough for several pages), plus a nearly full event (one seat left), a sold-out event, and a past event on which the test user already holds a booking. `npm run seed -- --reset` wipes events and bookings and recreates the samples. The admin account can only be created this way, because the register endpoint always creates plain users.

### Tests

```bash
cd backend
npm test
```

The tests use `TEST_DATABASE_URL` (a separate database) and **delete all rows in it**, so never point it at a database you care about.

## Deployment

> TODO: confirm these match what you actually did, and fix anything that differs.

- **Database:** a Supabase project. Tables were created with `npm run migrate` and sample data with `npm run seed`, run from my computer with `DATABASE_URL` pointing at Supabase (Session pooler string, `DATABASE_SSL=true`).
- **Backend:** Render web service. Root directory `backend`, build command `npm install`, start command `npm start`. Environment variables: `DATABASE_URL`, `DATABASE_SSL`, `JWT_SECRET`, `CORS_ORIGINS` (set to the Vercel address).
- **Frontend:** Vercel project. Root directory `frontend`, environment variable `NEXT_PUBLIC_API_URL` set to the Render address.

## Data model

```
users     id, name, email (unique, case-insensitive), password_hash, role ('user' | 'admin'), created_at
events    id, title, description, starts_at (timestamptz), venue, total_seats (> 0), created_at, updated_at
bookings  id, user_id -> users, event_id -> events, status ('confirmed' | 'cancelled'), created_at, cancelled_at
```

- A cancelled booking stays as a row with `status = 'cancelled'`. Only `confirmed` rows hold a seat. This keeps history and lets someone book again after cancelling.
- A partial unique index on `bookings (user_id, event_id) WHERE status = 'confirmed'` makes the database itself refuse a second active booking, whatever the application code does.
- **Seats left is not stored.** It is `total_seats` minus the number of confirmed bookings, calculated on every read, so it can never drift out of sync.

## API

Every error has one shape: `{ "error": { "code": "EVENT_FULL", "message": "...", "details": [...] } }`. Unexpected errors return a generic 500 and are logged on the server only, so no internal details reach the client.

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | public | Create a user account |
| POST | `/api/auth/login` | public | Returns the user and a token |
| GET | `/api/auth/me` | logged in | The current user |
| GET | `/api/events?search=&scope=&page=&pageSize=` | public | Paginated list. `scope` is `upcoming` (default), `past` or `all`. `search` matches the title. |
| GET | `/api/events/:id` | public | One event (adds `myBookingId` when logged in) |
| POST | `/api/events` | admin | Create an event |
| PATCH | `/api/events/:id` | admin | Edit an event |
| DELETE | `/api/events/:id` | admin | Delete an event |
| GET | `/api/events/:id/bookings` | admin | Attendee list |
| POST | `/api/events/:id/bookings` | logged in | Book one seat |
| GET | `/api/bookings/mine` | logged in | My bookings |
| POST | `/api/bookings/:id/cancel` | owner | Cancel a booking |

Send the token as `Authorization: Bearer <token>`. Status codes: no token gives `401`; a logged-in user on an admin route, or on someone else's booking, gives `403`; a rule violation gives `409` with one of these codes: `ALREADY_BOOKED`, `EVENT_FULL`, `EVENT_PAST`, `ALREADY_CANCELLED`, `SEATS_BELOW_BOOKED`, `EVENT_HAS_BOOKINGS`, `EMAIL_TAKEN`. Bad input gives `400` with a list of the fields that failed.

## Frontend pages

| Page | Who can open it | What it does |
|---|---|---|
| `/` | everyone | Event list with title search and pagination; search and page number are kept in the address |
| `/events/[id]` | everyone | Event details and seats left. Logged-in users can book or cancel; others see "Log in to book a seat" |
| `/login`, `/register` | everyone | Log in or create an account; after logging in you return to the page you came from |
| `/bookings` | logged in | My bookings, with cancel |
| `/admin` | admin | All events (past and upcoming), edit, delete |
| `/admin/events/new` | admin | Create an event |
| `/admin/events/[id]` | admin | Edit an event and see its attendees |

## Decisions and trade-offs

**Booking and the last-seat race.** A booking runs in one database transaction. It first locks the event row (`SELECT ... FOR UPDATE`) and then checks, in order: the event exists, it has not started, the user has no active booking, and seats remain. Only then does it insert. The lock makes people booking the same event wait for each other, so two people racing for the last seat cannot both succeed: the second one waits, then sees the event is full. The unique index is a second line of defence against double booking. Editing an event's seat total takes the same lock.

**Deleting an event that has bookings.** It is refused with `409 EVENT_HAS_BOOKINGS`. Deleting silently would remove seats people were promised, and cascading would hide that from them. An event with only cancelled bookings can be deleted, and that history goes with it.

**Past events.** "Past" means `starts_at` is not later than the server's current time. Booking and cancelling are both refused after that. A new event must start in the future; editing has no such restriction.

**Cancelling is a status change, not a delete.** The update only applies to a booking that is still `confirmed`, so a double click cannot cancel twice.

**Auth in the backend.** The role is never read from a request; everyone who registers is a plain user. The server loads the user from the database on every request, so a deleted user or a changed role takes effect immediately. A wrong email and a wrong password give the same message, and an unknown email still runs a password comparison so response time does not reveal which emails exist.

**Auth in the frontend.** The login token is kept in the browser's `localStorage` and sent as a Bearer header. This is simple and works across two different domains, but any script injected into the page could read it; an httpOnly cookie would be safer and would be my next step. Logging out only discards the token in the browser, so a stolen token stays valid until it expires (7 days).

**Hiding pages is not security.** Pages like `/admin` redirect people who are not admins, but that is only for convenience. The real checks are in the backend, which refuses admin routes for everyone else even if someone calls the API directly.

**Server-side everything that matters.** Search and pagination are done in the database query, and seat counts and rule checks happen in the backend. The frontend also disables or hides buttons (for example "Sold out"), but never relies on that.

**Client-rendered pages.** Pages load their data in the browser after the page opens, which keeps the frontend simple and lets every page show loading, error and empty states. The trade-off is that search engines see little of the content.

**Admins can book seats too.** I did not add a special case to forbid it.

## How I tested it

Automated: `npm test` in `backend` runs 10 tests covering double booking, a full event, the last-seat race (8 simultaneous requests for 1 seat), past events, cancelling someone else's booking, reducing seats below the booked count, admin-only routes, and registration ignoring a role sent by the client.

Manual checklist from the brief. Tick only what you really checked, and delete the rest:

- [ ] Register, log in and log out
- [ ] Book an event, then try to book it again (refused)
- [ ] Try to book the sold-out event (refused)
- [ ] Try to book the past event (refused)
- [ ] Cancel a booking and see the seat count go back up
- [ ] Call an admin route as a normal user (403) and with no login (401)
- [ ] Search and page through the event list
- [ ] Create, edit and delete an event as admin; try reducing seats below the booked count (refused)
- [ ] Everything above again on the live site

## AI usage

I used Claude (Anthropic's AI assistant) on this project. I am a beginner, so I want to be clear about what was generated and what I did myself.

**Generated by Claude**
- Backend code: the database schema, the Express app, register and login with tokens, the events and bookings routes, the booking rules, the seed script and the tests.
- Frontend code: components, API helper.

**Done by me**
- Set up my computer and project: installed Node, Git, VS Code and Postman, created the project folders and the Git repository, and made the commits.
- Created my own Supabase project and database, wrote my own `.env` settings, connected the backend to the database, and ran the migrate and seed scripts myself.
- Created the files in my own project and added the code from Claude file by file, running and checking the app as I went.
- Ran into real setup problems and fixed them, with Claude helping to diagnose them: the Supabase direct connection not working on my network (fixed by using the Session pooler), and a `#` in a `.env` password cutting the value short, which made the seeded logins fail.
- Tested the app myself in the browser.

**What I am still learning**
I did not write this project from scratch, and I am not presenting the code as my own original work. I am working through the files to understand them so I can explain how they work.

> TODO: add any other part you really did yourself (for example, code you changed or wrote, or a rule you worked out before seeing it), and delete any line above that is not true for you.

## Known issues and next steps

- The login token is in `localStorage` and cannot be revoked on logout (see above). HttpOnly cookies, or short-lived tokens with refresh tokens, would improve this.
- Login and registration have no rate limiting yet, so passwords could be guessed by repeated tries. Adding `express-rate-limit` on those two routes is the next security step.
- An event with bookings cannot be deleted until each booker cancels; there is no admin "cancel booking" action yet.
- The frontend has no automated tests, and I have not tested it across many browsers and phones.
- No Docker Compose setup yet.