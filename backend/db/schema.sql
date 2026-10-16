create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  email         text        not null,
  password_hash text        not null,
  role          text        not null default 'user' check (role in ('user', 'admin')),
  created_at    timestamptz not null default now()
);
create unique index if not exists users_email_lower_key on users (lower(email));

create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null,
  description text        not null,
  starts_at   timestamptz not null,
  venue       text        not null,
  total_seats integer     not null check (total_seats > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists bookings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references users(id),
  event_id     uuid        not null references events(id),
  status       text        not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at   timestamptz not null default now(),
  cancelled_at timestamptz
);
create unique index if not exists bookings_one_active_per_user_event
  on bookings (user_id, event_id) where status = 'confirmed';