export type User = { id: string; name: string; email: string; role: 'user' | 'admin' };

export type EventItem = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  venue: string;
  totalSeats: number;
  seatsLeft: number;
  isPast: boolean;
  myBookingId?: string | null;
};

export type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

export type MyBooking = {
  id: string;
  status: 'confirmed' | 'cancelled';
  bookedAt: string;
  cancelledAt: string | null;
  event: { id: string; title: string; startsAt: string; venue: string; isPast: boolean };
};

export type Attendee = { id: string; bookedAt: string; user: { id: string; name: string; email: string } };
