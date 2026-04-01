import type { Handler } from "aws-lambda";
import type { ExplorerAction } from "../../../src/lib/contracts";
import { executeExplorerAction } from "../../../src/lib/explorer-service";

export const handler: Handler<ExplorerAction> = async (event) => {
  try {
    return await executeExplorerAction(event);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown handler error",
    };
  }
};
