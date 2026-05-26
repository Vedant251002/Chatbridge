export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ConfigurationError extends AppError {
  readonly code = "CONFIGURATION_ERROR";
  readonly statusCode = 500;
}

export class DatabaseError extends AppError {
  readonly code = "DATABASE_ERROR";
  readonly statusCode = 500;
}

export class WhatsAppError extends AppError {
  readonly code = "WHATSAPP_ERROR";
  readonly statusCode = 502;
}

export class AiServiceError extends AppError {
  readonly code = "AI_SERVICE_ERROR";
  readonly statusCode = 502;
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR";
  readonly statusCode = 400;

  constructor(
    message: string,
    public readonly fields: Record<string, string[]> = {}
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";
  readonly statusCode = 404;

  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`);
  }
}

export class QueueError extends AppError {
  readonly code = "QUEUE_ERROR";
  readonly statusCode = 500;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function serializeError(error: unknown): {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
} {
  if (error instanceof ValidationError) {
    return {
      code: error.code,
      message: error.message,
      fields: error.fields,
    };
  }

  if (isAppError(error)) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
  };
}
