import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db.js';
import { conflict, unauthorized } from '../errors.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password is too long'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

// Used when the email doesn't exist, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post('/register', validate(registerSchema), async (req, res) => {
  const { name, email, password } = req.valid.body;
  const passwordHash = await bcrypt.hash(password, 10);

  // The role is never read from the request: everyone who registers is a plain user.
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (lower(email)) DO NOTHING
     RETURNING id, name, email, role`,
    [name, email, passwordHash],
  );
  if (!rows[0]) throw conflict('EMAIL_TAKEN', 'An account with this email already exists');

  res.status(201).json({ user: rows[0], token: signToken(rows[0]) });
});

router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.valid.body;
  const { rows } = await pool.query(
    'SELECT id, name, email, role, password_hash FROM users WHERE lower(email) = $1',
    [email],
  );
  const row = rows[0];
  const ok = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !ok) throw unauthorized('Invalid email or password');

  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  res.json({ user, token: signToken(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;