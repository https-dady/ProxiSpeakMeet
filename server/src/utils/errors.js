/** Typed application errors so the HTTP/socket layers can map them cleanly. */
export class ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.details = details;
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

export class RateLimitError extends Error {
  constructor(message = 'Too many requests') {
    super(message);
    this.name = 'RateLimitError';
    this.status = 429;
  }
}

export class ServiceError extends Error {
  constructor(message, { status = 500, cause } = {}) {
    super(message);
    this.name = 'ServiceError';
    this.status = status;
    this.cause = cause;
  }
}