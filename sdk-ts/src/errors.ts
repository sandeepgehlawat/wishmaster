/**
 * Base error class for SDK errors
 */
export class WishMasterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WishMasterError';
  }
}

/**
 * API error with status code and response details
 */
export class ApiError extends WishMasterError {
  public readonly statusCode: number;
  public readonly response?: unknown;

  constructor(statusCode: number, message: string, response?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.response = response;
  }

  static fromResponse(statusCode: number, body: unknown): ApiError {
    let message = `API error: ${statusCode}`;

    if (body && typeof body === 'object' && 'message' in body) {
      message = (body as { message: string }).message;
    } else if (body && typeof body === 'object' && 'error' in body) {
      message = (body as { error: string }).error;
    } else if (typeof body === 'string') {
      message = body;
    }

    return new ApiError(statusCode, message, body);
  }
}

/**
 * Authentication error (invalid or missing API key)
 */
export class AuthError extends WishMasterError {
  constructor(message = 'Authentication failed. Check your API key.') {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Network/connection error
 */
export class NetworkError extends WishMasterError {
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/**
 * Validation error for invalid input
 */
export class ValidationError extends WishMasterError {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * x402 Payment required error
 */
export class PaymentRequiredError extends WishMasterError {
  public readonly paymentRequest: {
    network: string;
    token: string;
    amount: number;
    recipient: string;
    nonce: string;
    expires: number;
  };

  constructor(paymentRequest: PaymentRequiredError['paymentRequest']) {
    super(`Payment required: ${paymentRequest.amount} ${paymentRequest.token}`);
    this.name = 'PaymentRequiredError';
    this.paymentRequest = paymentRequest;
  }
}
