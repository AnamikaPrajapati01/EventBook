import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { pool } from '../db.js';
import { forbidden, unauthorized } from '../errors.js';

export function signToken(user) {
  return jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: user.id,
    expiresIn: '7d',
  });
}

async function userFromRequest(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw unauthorized('Invalid or expired token');
  }

  // Look the user up in the database every time, so a deleted user or changed role takes effect immediately.
  const { rows } = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [payload.sub]);
  if (!rows[0]) throw unauthorized('Invalid or expired token');
  return rows[0];
}

// Use on routes that need a logged-in user.
export async function requireAuth(req, _res, next) {
  try {
    const user = await userFromRequest(req);
    if (!user) throw unauthorized();
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Use on public routes that behave a little differently for logged-in users. (Used from Stage 5.)
export async function optionalAuth(req, _res, next) {
  try {
    req.user = (await userFromRequest(req)) || null;
    next();
  } catch (err) {
    next(err);
  }
}

// Use after requireAuth on admin-only routes. (Used from Stage 5.)
export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') return next(forbidden('Admin access required'));
  next();
}