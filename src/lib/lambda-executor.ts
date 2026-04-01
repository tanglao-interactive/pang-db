import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { promises as fs } from "fs";
import path from "path";
import type { ApiErrorResponse, ConnectionStatusResponse, ExplorerAction, ExplorerResult } from "@/lib/contracts";
import { tryReadExplorerEnv } from "@/lib/env";
import { ExplorerError, normalizeExplorerError } from "@/lib/explorer-error";
import { executeExplorerAction } from "@/lib/explorer-service";

export async function dispatchExplorerAction(
  action: ExplorerAction,
): Promise<ExplorerResult> {
  const functionName = await resolveFunctionName();
  if (!functionName) {
    return executeExplorerAction(action);
  }

  const env = tryReadExplorerEnv();
  if (!env.ok) {
    return {
      ok: false,
      connected: false,
      via: "lambda",
      error: env.error,
      stage: "env",
    } satisfies ConnectionStatusResponse;
  }

  const client = new LambdaClient({ region: env.value.awsRegion });
  const command = new InvokeCommand({
    FunctionName: functionName,
    Payload: Buffer.from(JSON.stringify(action)),
  });
  const response = await client.send(command);
  const payload = response.Payload
    ? JSON.parse(Buffer.from(response.Payload).toString("utf8"))
    : null;

  if (isApiErrorResponse(payload)) {
    throw new ExplorerError(payload.error, {
      stage: payload.stage,
      details: payload.details,
    });
  }

  if (payload?.error) {
    throw normalizeExplorerError(payload.error, "query");
  }

  return payload as ExplorerResult;
}

function isApiErrorResponse(payload: unknown): payload is ApiErrorResponse {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "ok" in payload &&
      "error" in payload &&
      "stage" in payload,
  );
}

async function resolveFunctionName(): Promise<string | undefined> {
  const explicitFunctionName = process.env.AMPLIFY_DB_EXPLORER_FUNCTION_NAME;
  if (explicitFunctionName) {
    return explicitFunctionName;
  }

  const outputsPath = path.join(process.cwd(), "amplify_outputs.json");
  try {
    const raw = await fs.readFile(outputsPath, "utf8");
    const outputs = JSON.parse(raw) as {
      custom?: { dbExplorerFunctionName?: string };
    };
    return outputs.custom?.dbExplorerFunctionName;
  } catch {
    return undefined;
  }
}
