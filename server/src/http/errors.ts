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
    super(400, 'INVALID_JSON', 'Request body is not valid JSON');
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

export class InternalError extends AppError {
  constructor() {
    super(500, 'INTERNAL_ERROR', 'Something went wrong');
  }
}
