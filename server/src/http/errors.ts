export interface FieldError {
  field: string;
  message: string;
}

/** Base error: carries the HTTP status and the API error code. New failure kinds are new subclasses. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: FieldError[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(details: FieldError[]) {
    super(400, 'VALIDATION_ERROR', 'Invalid request', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Todo not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class InvalidJsonError extends AppError {
  constructor() {
    // Also used when the body is valid JSON but not an object/array (e.g. "text" or null),
    // which Express's strict JSON parser rejects, so the message names the requirement.
    super(400, 'INVALID_JSON', 'Request body must be a valid JSON object');
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor() {
    super(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
  }
}

export class PayloadTooLargeError extends AppError {
  constructor() {
    super(413, 'PAYLOAD_TOO_LARGE', 'Request body must be at most 10 KB');
  }
}

export class BadRequestError extends AppError {
  constructor() {
    super(400, 'BAD_REQUEST', 'Malformed request');
  }
}

export class InternalError extends AppError {
  constructor() {
    super(500, 'INTERNAL_ERROR', 'Something went wrong');
  }
}
