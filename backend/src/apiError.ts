import type { Response } from "express";
import { requestCorrelationId } from "./requestCorrelation.js";

export function sendApiError(
  response: Response,
  status: number,
  code: string,
  message: string,
  retryable = false,
): void {
  response.locals.errorCategory = code;
  response.status(status).json({
    error: {
      code,
      message,
      correlationId: requestCorrelationId(response),
      retryable,
    },
  });
}
