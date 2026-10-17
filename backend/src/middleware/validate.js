import { badRequest, notFound } from '../errors.js';

// Validates req[source] with a zod schema and replaces it with the parsed value.
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.') || source,
        message: i.message,
      }));
      return next(badRequest('Validation failed', details));
    }
    // req.query is a getter in Express 5, so store parsed values separately.
    req.valid = { ...req.valid, [source]: result.data };
    next();
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A malformed id can never match a row, so answer 404 instead of letting Postgres throw.
export function uuidParam(name = 'id') {
  return (req, _res, next) => (UUID_RE.test(req.params[name]) ? next() : next(notFound()));
}
