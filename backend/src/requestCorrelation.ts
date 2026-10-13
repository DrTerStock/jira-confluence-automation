import { randomUUID } from "node:crypto";
import type { Response } from "express";

export function requestCorrelationId(response: Response): string {
  const correlationId = response.locals.correlationId;
  return typeof correlationId === "string" ? correlationId : randomUUID();
}
