'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFetch } from '@/lib/useFetch';
import type { EventItem, Pagination as PaginationInfo } from '@/lib/types';
import { EventCard } from '@/components/EventCard';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, Loading } from '@/components/States';

const PAGE_SIZE = 8;

function EventList() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [draft, setDraft] = useState(q);

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (q) query.set('search', q);
  const { data, error, loading, reload } = useFetch<{ data: EventItem[]; pagination: PaginationInfo }>(`/api/events?${query}`);

  function go(nextQ: string, nextPage: number) {
    const next = new URLSearchParams();
    if (nextQ) next.set('q', nextQ);
    if (nextPage > 1) next.set('page', String(nextPage));
    router.push(next.size ? `/?${next}` : '/');
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    go(draft.trim(), 1);
  }

  return (
    <>
      <div className="section">
        <h1>Upcoming events</h1>
        <p className="lede">Pick a workshop, meetup or concert and book your seat. You can browse without an account.</p>
        <form className="search" onSubmit={onSearch} role="search">
          <input
            className="input"
            type="search"
            aria-label="Search events by title"
            placeholder="Search by title"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="btn" type="submit">Search</button>
        </form>
      </div>

      {loading && <Loading label="Loading events…" />}
      {!loading && error != null && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && data && (
        <>
          {data.data.length === 0 ? (
            <EmptyState title={q ? `No upcoming events match “${q}”` : 'No upcoming events yet'}>
              {q && (
                <button className="btn btn--quiet" onClick={() => { setDraft(''); go('', 1); }}>
                  Clear search
                </button>
              )}
            </EmptyState>
          ) : (
            <>
              <p className="muted">
                Showing {data.data.length} of {data.pagination.total} {data.pagination.total === 1 ? 'event' : 'events'}
              </p>
              <ul className="ticket-list">
                {data.data.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </ul>
              <Pagination info={data.pagination} onPage={(p) => go(q, p)} />
            </>
          )}
        </>
      )}
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<Loading label="Loading events…" />}>
      <EventList />
    </Suspense>
  );
}
