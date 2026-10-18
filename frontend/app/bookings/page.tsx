'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api';
import { useRequireUser } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';
import type { MyBooking } from '@/lib/types';
import { EmptyState, ErrorState, Loading, Notice } from '@/components/States';

export default function MyBookingsPage() {
  const { user, loading: authLoading } = useRequireUser();
  const { data, error, loading, reload } = useFetch<{ data: MyBooking[] }>(user ? '/api/bookings/mine' : null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  async function cancel(booking: MyBooking) {
    if (!window.confirm(`Cancel your booking for “${booking.event.title}”?`)) return;
    setCancelling(booking.id);
    setMessage(null);
    try {
      await api(`/api/bookings/${booking.id}/cancel`, { method: 'POST' });
      setMessage({ kind: 'ok', text: `Cancelled “${booking.event.title}”. Your seat is free again.` });
    } catch (err) {
      setMessage({ kind: 'error', text: errorMessage(err) });
    } finally {
      setCancelling(null);
      reload();
    }
  }

  if (authLoading || (loading && !data)) return <Loading label="Loading your bookings…" />;
  if (error != null && !data) return <ErrorState error={error} onRetry={reload} />;

  const bookings = data?.data ?? [];
  return (
    <div className="section">
      <h1>My bookings</h1>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      {bookings.length === 0 ? (
        <EmptyState title="You haven't booked anything yet">
          <Link className="btn" href="/">Browse events</Link>
        </EmptyState>
      ) : (
        <ul className="rows">
          {bookings.map((b) => (
            <li key={b.id} className="row">
              <div className="row__main">
                <Link href={`/events/${b.event.id}`} className="row__title">{b.event.title}</Link>
                <span className="muted">{formatDateTime(b.event.startsAt)} · {b.event.venue}</span>
              </div>
              <div className="row__actions">
                {b.status === 'cancelled' ? (
                  <span className="badge badge--off">Cancelled</span>
                ) : b.event.isPast ? (
                  <span className="badge badge--off">Event has passed</span>
                ) : (
                  <>
                    <span className="badge">Booked</span>
                    <button className="btn btn--danger btn--small" disabled={cancelling === b.id} onClick={() => cancel(b)}>
                      {cancelling === b.id ? 'Cancelling…' : 'Cancel booking'}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}