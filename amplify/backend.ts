import "dotenv/config";
import { defineBackend } from "@aws-amplify/backend";
import { dbExplorer } from "./functions/db-explorer/resource";

const backend = defineBackend({
  dbExplorer,
});

backend.addOutput({
  custom: {
    dbExplorerFunctionName: backend.dbExplorer.resources.lambda.functionName,
  },
});
