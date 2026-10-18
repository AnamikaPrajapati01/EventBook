'use client';

import { useState, type FormEvent } from 'react';
import { errorMessage } from '@/lib/api';
import { toLocalInput } from '@/lib/format';
import type { EventItem } from '@/lib/types';
import { Notice } from './States';

export type EventPayload = { title: string; description: string; startsAt: string; venue: string; totalSeats: number };

type Props = {
  initial?: EventItem;
  submitLabel: string;
  onSubmit: (payload: EventPayload) => Promise<void>;
};

export function EventForm({ initial, submitLabel, onSubmit }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const booked = initial ? initial.totalSeats - initial.seatsLeft : 0;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setSaving(true);
    try {
      await onSubmit({
        title: String(form.get('title')),
        description: String(form.get('description')),
        startsAt: new Date(String(form.get('startsAt'))).toISOString(),
        venue: String(form.get('venue')),
        totalSeats: Number(form.get('totalSeats')),
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      {error && <Notice kind="error">{error}</Notice>}
      <label className="field">
        <span className="field__label">Title</span>
        <input className="input" name="title" defaultValue={initial?.title} required maxLength={150} />
      </label>
      <label className="field">
        <span className="field__label">Description</span>
        <textarea className="input" name="description" defaultValue={initial?.description} required maxLength={5000} />
      </label>
      <label className="field">
        <span className="field__label">Date and time</span>
        <input className="input" type="datetime-local" name="startsAt" defaultValue={initial ? toLocalInput(initial.startsAt) : ''} required />
      </label>
      <label className="field">
        <span className="field__label">Venue</span>
        <input className="input" name="venue" defaultValue={initial?.venue} required maxLength={200} />
      </label>
      <label className="field">
        <span className="field__label">Total seats</span>
        <input className="input" type="number" name="totalSeats" defaultValue={initial?.totalSeats} min={Math.max(1, booked)} step={1} required />
        {booked > 0 && <span className="field__hint">{booked} seats are already booked, so the total can&apos;t go below that.</span>}
      </label>
      <button className="btn" type="submit" disabled={saving}>
        {saving ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}