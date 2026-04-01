import type {
  ApiErrorResponse,
  ConnectionStatusResponse,
  QueryRequest,
  QueryResponse,
  SchemaItem,
  TableDataRequest,
  TableDataResponse,
  TableItem,
} from "@/lib/contracts";
import { dispatchExplorerAction } from "@/lib/lambda-executor";
import { normalizeExplorerError } from "@/lib/explorer-error";

export async function handleConnectionRequest(): Promise<ConnectionStatusResponse> {
  return (await dispatchExplorerAction({ type: "connection" })) as ConnectionStatusResponse;
}

export async function handleSchemasRequest(): Promise<SchemaItem[]> {
  return (await dispatchExplorerAction({ type: "schemas" })) as SchemaItem[];
}

export async function handleTablesRequest(schema: string): Promise<TableItem[]> {
  return (await dispatchExplorerAction({ type: "tables", schema })) as TableItem[];
}

export async function handleTableRequest(input: TableDataRequest): Promise<TableDataResponse> {
  return (await dispatchExplorerAction({ type: "table", input })) as TableDataResponse;
}

export async function handleQueryRequest(input: QueryRequest): Promise<QueryResponse> {
  return (await dispatchExplorerAction({ type: "query", input })) as QueryResponse;
}

export function toApiErrorResponse(error: unknown): ApiErrorResponse {
  const normalized = normalizeExplorerError(error, "query");
  return {
    ok: false,
    error: normalized.message,
    stage: normalized.stage,
    details: normalized.details,
  };
}
