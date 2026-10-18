'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useRequireUser } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';
import type { Attendee, EventItem } from '@/lib/types';
import { EventForm, type EventPayload } from '@/components/EventForm';
import { EmptyState, ErrorState, Loading, Notice } from '@/components/States';

export default function EditEventPage() {
  return (
    <Suspense fallback={<Loading label="Loading event…" />}>
      <EditEvent />
    </Suspense>
  );
}

function EditEvent() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useRequireUser(true);
  const event = useFetch<{ event: EventItem }>(user ? `/api/events/${id}` : null);
  const attendees = useFetch<{ data: Attendee[] }>(user ? `/api/events/${id}/bookings` : null);
  const [saved, setSaved] = useState(false);

  if (authLoading || (event.loading && !event.data)) return <Loading label="Loading event…" />;
  if (event.error != null && !event.data) return <ErrorState error={event.error} onRetry={event.reload} />;
  if (!event.data) return null;

  async function save(payload: EventPayload) {
    setSaved(false);
    await api(`/api/events/${id}`, { method: 'PATCH', body: payload });
    setSaved(true);
    event.reload();
    attendees.reload();
  }

  return (
    <div className="section narrow">
      <Link href="/admin" className="back">← Manage events</Link>
      <h1>Edit event</h1>
      {saved && <Notice kind="ok">Changes saved.</Notice>}
      {/* key remounts the form with fresh defaults after each reload */}
      <EventForm key={event.data.event.seatsLeft + event.data.event.title + event.data.event.startsAt} initial={event.data.event} submitLabel="Save changes" onSubmit={save} />

      <h2>Attendees</h2>
      {attendees.loading && !attendees.data ? (
        <Loading label="Loading attendees…" />
      ) : attendees.error != null ? (
        <ErrorState error={attendees.error} onRetry={attendees.reload} />
      ) : attendees.data && attendees.data.data.length > 0 ? (
        <ul className="rows">
          {attendees.data.data.map((a) => (
            <li key={a.id} className="row">
              <div className="row__main">
                <span className="row__title">{a.user.name}</span>
                <span className="muted">{a.user.email}</span>
              </div>
              <span className="muted">Booked {formatDateTime(a.bookedAt)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nobody has booked this event yet" />
      )}
    </div>
  );
}