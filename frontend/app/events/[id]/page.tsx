'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateParts, formatDateTime } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';
import type { EventItem } from '@/lib/types';
import { SeatMeter } from '@/components/SeatMeter';
import { ErrorState, Loading, Notice } from '@/components/States';

export default function EventDetailPage() {
  return (
    <Suspense fallback={<Loading label="Loading event…" />}>
      <EventDetail />
    </Suspense>
  );
}

function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, error, loading, reload } = useFetch<{ event: EventItem }>(`/api/events/${id}`);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ kind: 'ok', text: success });
    } catch (err) {
      setMessage({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
      reload(); // seat counts may have changed, whatever the outcome
    }
  }

  if (loading && !data) return <Loading label="Loading event…" />;
  if (error != null && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const event = data.event;
  const { month, day } = dateParts(event.startsAt);

  return (
    <div className="detail">
      <Link href="/" className="back">← All events</Link>
      <div className="section">
        <h1>{event.title}</h1>
        <div className="detail__meta">
          <span>{formatDateTime(event.startsAt)}</span>
          <span>{event.venue}</span>
        </div>
      </div>

      <p className="detail__text">{event.description}</p>

      <div className="detail__action" aria-label={`Booking for ${day} ${month}`}>
        <SeatMeter event={event} />
        {message && <Notice kind={message.kind}>{message.text}</Notice>}

        {event.isPast ? (
          <p className="muted">This event has already started, so booking is closed.</p>
        ) : event.myBookingId ? (
          <>
            <p><strong>You have a seat.</strong> See all your seats under <Link href="/bookings">My bookings</Link>.</p>
            <button
              className="btn btn--danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Cancel your booking for this event?')) {
                  run(() => api(`/api/bookings/${event.myBookingId}/cancel`, { method: 'POST' }), 'Booking cancelled. Your seat is free again.');
                }
              }}
            >
              {busy ? 'Cancelling…' : 'Cancel my booking'}
            </button>
          </>
        ) : !user ? (
          <Link className="btn" href={`/login?next=${encodeURIComponent(`/events/${event.id}`)}`}>
            Log in to book a seat
          </Link>
        ) : (
          <button
            className="btn"
            disabled={busy || event.seatsLeft === 0}
            onClick={() => run(() => api(`/api/events/${event.id}/bookings`, { method: 'POST' }), 'Seat booked. See you there!')}
          >
            {busy ? 'Booking…' : event.seatsLeft === 0 ? 'Sold out' : 'Book a seat'}
          </button>
        )}

        {user?.role === 'admin' && (
          <Link className="btn btn--quiet btn--small" href={`/admin/events/${event.id}`}>
            Manage this event
          </Link>
        )}
      </div>
    </div>
  );
}