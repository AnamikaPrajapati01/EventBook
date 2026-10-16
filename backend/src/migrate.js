import { readFile } from 'node:fs/promises';
import { pool } from './db.js';

const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
await pool.query(schema);
console.log('Schema applied.');
await pool.end();