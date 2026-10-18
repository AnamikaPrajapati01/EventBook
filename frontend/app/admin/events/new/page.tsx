'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useRequireUser } from '@/lib/auth';
import { EventForm, type EventPayload } from '@/components/EventForm';
import { Loading } from '@/components/States';

export default function NewEventPage() {
  const { user, loading } = useRequireUser(true);
  const router = useRouter();

  if (loading || !user) return <Loading />;

  async function create(payload: EventPayload) {
    await api('/api/events', { method: 'POST', body: payload });
    router.push('/admin');
  }

  return (
    <div className="center-page">
      <div className="section narrow">
        <Link href="/admin" className="back">← Manage events</Link>
        <h1>New event</h1>
        <EventForm submitLabel="Create event" onSubmit={create} />
      </div>
    </div>
  );
}