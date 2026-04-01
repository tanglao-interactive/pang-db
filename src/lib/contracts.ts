export type SortDirection = "asc" | "desc";
export type DiagnosticStage = "env" | "secret" | "network" | "ssl" | "auth" | "query";

export interface ApiErrorResponse {
  ok: false;
  error: string;
  stage: DiagnosticStage;
  details?: string;
}

export interface ConnectionStatusResponse {
  ok: boolean;
  connected: boolean;
  via: "lambda" | "server";
  database?: string;
  currentUser?: string;
  currentSchema?: string;
  version?: string;
  configSource?: "url" | "secret";
  error?: string;
  stage?: DiagnosticStage;
  details?: string;
}

export interface SchemaItem {
  name: string;
}

export interface TableItem {
  schema: string;
  name: string;
  type: "table" | "view";
}

export interface ColumnMeta {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

export interface TableDataRequest {
  schema: string;
  table: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  filter?: string;
}

export interface TableDataResponse {
  schema: string;
  table: string;
  totalRows: number;
  page: number;
  pageSize: number;
  sort?: {
    column: string;
    direction: SortDirection;
  };
  columns: ColumnMeta[];
  rows: Record<string, unknown>[];
}

export interface QueryRequest {
  sql: string;
  allowWrite?: boolean;
}

export interface QueryResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
  notices: string[];
  rejected?: boolean;
  error?: string;
  stage?: DiagnosticStage;
  details?: string;
}

export type ExplorerAction =
  | { type: "connection" }
  | { type: "schemas" }
  | { type: "tables"; schema: string }
  | { type: "table"; input: TableDataRequest }
  | { type: "query"; input: QueryRequest };

export type ExplorerResult =
  | ConnectionStatusResponse
  | SchemaItem[]
  | TableItem[]
  | TableDataResponse
  | QueryResponse
  | ApiErrorResponse;
