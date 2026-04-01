import type { Handler } from "aws-lambda";
import type { ExplorerAction } from "../../../src/lib/contracts";
import { normalizeExplorerError } from "../../../src/lib/explorer-error";
import { executeExplorerAction } from "../../../src/lib/explorer-service";

export const handler: Handler<ExplorerAction> = async (event) => {
  try {
    return await executeExplorerAction(event);
  } catch (error) {
    const normalized = normalizeExplorerError(error, "query");
    return {
      ok: false,
      error: normalized.message,
      stage: normalized.stage,
      details: normalized.details,
    };
  }
};
