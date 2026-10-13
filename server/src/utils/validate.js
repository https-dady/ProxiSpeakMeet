/** Input validation for socket payloads and HTTP query/body params. */
import { ValidationError } from './errors.js';

export const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
export const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/** Round to 2 decimals — keeps MongoDB documents and socket traffic small. */
export const round2 = (value) => Math.round(value * 100) / 100;

export function requireFiniteNumber(value, field, { min = -Infinity, max = Infinity } = {}) {
  if (!isFiniteNumber(value)) throw new ValidationError(`"${field}" must be a finite number`, { field, value });
  if (value < min || value > max) throw new ValidationError(`"${field}" must be within [${min}, ${max}]`, { field, value });
  return value;
}

export function requireString(value, field, { min = 1, max = 64, pattern } = {}) {
  if (typeof value !== 'string') throw new ValidationError(`"${field}" must be a string`, { field });
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new ValidationError(`"${field}" must be ${min}-${max} characters`, { field });
  }
  if (pattern && !pattern.test(trimmed)) throw new ValidationError(`"${field}" has an unsupported format`, { field });
  return trimmed;
}

export function optionalString(value, field, opts = {}) {
  if (value === undefined || value === null || value === '') return undefined;
  return requireString(value, field, opts);
}

/** Cursor-style `{ next, prev }` pagination parser used by /api/rooms. */
export function parsePagination(query, { defaultLimit = 50, maxLimit = 200 } = {}) {
  const limit = clamp(Number(query.limit ?? defaultLimit) || defaultLimit, 1, maxLimit);
  const skip = Math.max(0, Number(query.skip ?? 0) || 0);
  return { limit, skip };
}