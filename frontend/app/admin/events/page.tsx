'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api';
import { useRequireUser } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { useFetch } from '@/lib/useFetch';
import type { EventItem, Pagination as PaginationInfo } from '@/lib/types';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, Loading, Notice } from '@/components/States';

export default function AdminEventsPage() {
  const { user, loading: authLoading } = useRequireUser(true);
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useFetch<{ data: EventItem[]; pagination: PaginationInfo }>(
    user ? `/api/events?scope=all&page=${page}&pageSize=10` : null,
  );
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function remove(event: EventItem) {
    if (!window.confirm(`Delete “${event.title}”? This cannot be undone.`)) return;
    setMessage(null);
    try {
      await api(`/api/events/${event.id}`, { method: 'DELETE' });
      setMessage({ kind: 'ok', text: `Deleted “${event.title}”.` });
    } catch (err) {
      setMessage({ kind: 'error', text: errorMessage(err) });
    } finally {
      reload();
    }
  }

  if (authLoading || (loading && !data)) return <Loading label="Loading events…" />;
  if (error != null && !data) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="section">
      <div className="page-head">
        <h1>Manage events</h1>
        <Link className="btn" href="/admin/events/new">New event</Link>
      </div>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      {!data || data.data.length === 0 ? (
        <EmptyState title="No events yet">
          <Link className="btn" href="/admin/events/new">Create the first event</Link>
        </EmptyState>
      ) : (
        <>
          <ul className="rows">
            {data.data.map((event) => (
              <li key={event.id} className="row">
                <div className="row__main">
                  <span className="row__title">{event.title}</span>
                  <span className="muted">{formatDateTime(event.startsAt)} · {event.venue}</span>
                  <span className="muted">
                    {event.totalSeats - event.seatsLeft} of {event.totalSeats} seats booked{event.isPast ? ' · past event' : ''}
                  </span>
                </div>
                <div className="row__actions">
                  <Link className="btn btn--quiet btn--small" href={`/admin/events/${event.id}`}>Edit and attendees</Link>
                  <button className="btn btn--danger btn--small" onClick={() => remove(event)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination info={data.pagination} onPage={setPage} />
        </>
      )}
    </div>
  );
}
