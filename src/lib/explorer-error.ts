import { ZodError } from "zod";
import type { DiagnosticStage } from "@/lib/contracts";

export class ExplorerError extends Error {
  readonly stage: DiagnosticStage;
  readonly details?: string;
  readonly statusCode: number;

  constructor(
    message: string,
    options: {
      stage: DiagnosticStage;
      details?: string;
      statusCode?: number;
    },
  ) {
    super(message);
    this.name = "ExplorerError";
    this.stage = options.stage;
    this.details = options.details;
    this.statusCode = options.statusCode ?? 500;
  }
}

export function normalizeExplorerError(
  error: unknown,
  fallbackStage: DiagnosticStage = "query",
): ExplorerError {
  if (error instanceof ExplorerError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new ExplorerError(error.issues[0]?.message ?? "Invalid environment.", {
      stage: "env",
      details: JSON.stringify(error.issues),
      statusCode: 500,
    });
  }

  if (error instanceof Error) {
    return new ExplorerError(error.message, {
      stage: classifyStageFromMessage(error.message, fallbackStage),
      statusCode: inferStatusCode(error.message),
    });
  }

  return new ExplorerError("Unknown error", {
    stage: fallbackStage,
    statusCode: 500,
  });
}

function classifyStageFromMessage(
  message: string,
  fallbackStage: DiagnosticStage,
): DiagnosticStage {
  const normalized = message.toLowerCase();

  if (normalized.includes("database_url") || normalized.includes("database_secret_arn")) {
    return "env";
  }
  if (
    normalized.includes("secret") ||
    normalized.includes("secretsmanager") ||
    normalized.includes("getsecretvalue") ||
    normalized.includes("accessdenied")
  ) {
    return "secret";
  }
  if (
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("connect etimedout") ||
    normalized.includes("econnrefused") ||
    normalized.includes("network")
  ) {
    return "network";
  }
  if (normalized.includes("ssl") || normalized.includes("certificate")) {
    return "ssl";
  }
  if (
    normalized.includes("password authentication failed") ||
    normalized.includes("authentication") ||
    normalized.includes("28p01")
  ) {
    return "auth";
  }

  return fallbackStage;
}

function inferStatusCode(message: string): number {
  const normalized = message.toLowerCase();
  if (normalized.includes("database_url") || normalized.includes("database_secret_arn")) {
    return 500;
  }
  if (normalized.includes("accessdenied")) {
    return 502;
  }
  if (normalized.includes("password authentication failed")) {
    return 401;
  }
  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return 504;
  }
  return 500;
}
