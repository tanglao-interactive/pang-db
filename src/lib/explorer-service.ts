import type { Knex } from "knex";
import { getDb } from "@/lib/db";
import { resolveDatabaseConnection } from "@/lib/db-config";
import type {
  ColumnMeta,
  ConnectionStatusResponse,
  ExplorerAction,
  ExplorerResult,
  QueryRequest,
  QueryResponse,
  SchemaItem,
  TableDataRequest,
  TableDataResponse,
  TableItem,
} from "@/lib/contracts";
import { assertQueryAllowed } from "@/lib/sql-guard";
import { normalizeExplorerError } from "@/lib/explorer-error";

export interface ExplorerService {
  getConnectionStatus(): Promise<ConnectionStatusResponse>;
  listSchemas(): Promise<SchemaItem[]>;
  listTables(schema: string): Promise<TableItem[]>;
  getTableData(input: TableDataRequest): Promise<TableDataResponse>;
  runQuery(input: QueryRequest): Promise<QueryResponse>;
}

export function createExplorerService(dbFactory: () => Promise<Knex> = getDb): ExplorerService {
  return {
    async getConnectionStatus() {
      try {
        const db = await dbFactory();
        const info = await db.raw<{
          rows: Array<{
            current_database: string;
            current_user: string;
            current_schema: string;
            version: string;
          }>;
        }>(
          `select current_database(), current_user, current_schema(), version()`,
        );
        const { source } = await resolveDatabaseConnection();
        const row = info.rows[0];
        return {
          ok: true,
          connected: true,
          via: "server",
          database: row.current_database,
          currentUser: row.current_user,
          currentSchema: row.current_schema,
          version: row.version,
          configSource: source,
        };
      } catch (error) {
        const normalized = normalizeExplorerError(error, "query");
        return {
          ok: false,
          connected: false,
          via: "server",
          error: normalized.message,
          stage: normalized.stage,
          details: normalized.details,
        };
      }
    },

    async listSchemas() {
      try {
        const db = await dbFactory();
        const result = await db.raw<{ rows: Array<{ name: string }> }>(
          `
            select schema_name as name
            from information_schema.schemata
            where schema_name not in ('information_schema', 'pg_catalog', 'pg_toast')
              and schema_name not like 'pg_temp_%'
              and schema_name not like 'pg_toast_temp_%'
            order by schema_name
          `,
        );
        return result.rows;
      } catch (error) {
        throw normalizeExplorerError(error, "query");
      }
    },

    async listTables(schema) {
      try {
        const db = await dbFactory();
        const result = await db.raw<{
          rows: Array<{ schema: string; name: string; type: "table" | "view" }>;
        }>(
          `
            select table_schema as schema,
                   table_name as name,
                   case
                     when table_type = 'VIEW' then 'view'
                     else 'table'
                   end as type
            from information_schema.tables
            where table_schema = ?
              and table_type in ('BASE TABLE', 'VIEW')
            order by table_name
          `,
          [schema],
        );

        return result.rows;
      } catch (error) {
        throw normalizeExplorerError(error, "query");
      }
    },

    async getTableData(input) {
      try {
        const db = await dbFactory();
        const pageSize = clamp(input.pageSize ?? 25, 10, 200);
        const page = Math.max(input.page ?? 0, 0);
        const columns = await getColumns(db, input.schema, input.table);
        const sort = resolveSort(input.sort, columns);
        const filter = input.filter?.trim();
        const quotedSchema = quoteIdent(input.schema);
        const quotedTable = quoteIdent(input.table);
        const fromClause = `${quotedSchema}.${quotedTable}`;
        const whereClause = buildFilterWhere(filter, columns);
        const filterBindings = buildFilterBindings(filter, columns);
        const orderClause = sort
          ? ` order by ${quoteIdent(sort.column)} ${sort.direction}`
          : "";

        const countResult = await db.raw<{ rows: Array<{ count: string }> }>(
          `select count(*)::text as count from ${fromClause}${whereClause}`,
          filterBindings,
        );

        const rowResult = await db.raw<{ rows: Record<string, unknown>[] }>(
          `select * from ${fromClause}${whereClause}${orderClause} limit ? offset ?`,
          [...filterBindings, pageSize, page * pageSize],
        );

        return {
          schema: input.schema,
          table: input.table,
          totalRows: Number(countResult.rows[0]?.count ?? 0),
          page,
          pageSize,
          sort,
          columns,
          rows: rowResult.rows,
        };
      } catch (error) {
        throw normalizeExplorerError(error, "query");
      }
    },

    async runQuery(input) {
      try {
        assertQueryAllowed(input.sql, input.allowWrite);
        const db = await dbFactory();
        const startedAt = Date.now();
        const result = await db.raw<{
          rows?: Record<string, unknown>[];
          rowCount?: number;
        }>(input.sql);
        const rows = result.rows ?? [];
        return {
          columns: rows[0] ? Object.keys(rows[0]) : [],
          rows,
          rowCount: typeof result.rowCount === "number" ? result.rowCount : rows.length,
          durationMs: Date.now() - startedAt,
          notices: [],
        };
      } catch (error) {
        const normalized = normalizeExplorerError(error, "query");
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          durationMs: 0,
          notices: [],
          error: normalized.message,
          stage: normalized.stage,
          details: normalized.details,
        };
      }
    },
  };
}

export async function executeExplorerAction(action: ExplorerAction): Promise<ExplorerResult> {
  const service = createExplorerService();
  switch (action.type) {
    case "connection":
      return service.getConnectionStatus();
    case "schemas":
      return service.listSchemas();
    case "tables":
      return service.listTables(action.schema);
    case "table":
      return service.getTableData(action.input);
    case "query":
      return service.runQuery(action.input);
    default:
      throw new Error("Unsupported explorer action.");
  }
}

async function getColumns(
  db: Knex,
  schema: string,
  table: string,
): Promise<ColumnMeta[]> {
  const result = await db.raw<{
    rows: ColumnMeta[];
  }>(
    `
      select
        cols.column_name as name,
        cols.data_type as "dataType",
        (cols.is_nullable = 'YES') as nullable,
        cols.column_default as "defaultValue",
        exists (
          select 1
          from information_schema.table_constraints tc
          join information_schema.key_column_usage kcu
            on tc.constraint_name = kcu.constraint_name
           and tc.table_schema = kcu.table_schema
           and tc.table_name = kcu.table_name
          where tc.constraint_type = 'PRIMARY KEY'
            and tc.table_schema = cols.table_schema
            and tc.table_name = cols.table_name
            and kcu.column_name = cols.column_name
        ) as "isPrimaryKey"
      from information_schema.columns cols
      where cols.table_schema = ?
        and cols.table_name = ?
      order by cols.ordinal_position
    `,
    [schema, table],
  );
  return result.rows;
}

function resolveSort(sortParam: string | undefined, columns: ColumnMeta[]) {
  if (!sortParam) {
    return undefined;
  }

  const [column, rawDirection] = sortParam.split(":");
  const direction = rawDirection?.toLowerCase() === "desc" ? "desc" : "asc";
  if (!columns.some((item) => item.name === column)) {
    return undefined;
  }

  return { column, direction } as const;
}

function buildFilterWhere(filter: string | undefined, columns: ColumnMeta[]): string {
  if (!filter || columns.length === 0) {
    return "";
  }

  const searchableColumns = columns.slice(0, 8);
  const conditions = searchableColumns
    .map((column) => `${quoteIdent(column.name)}::text ilike ?`)
    .join(" or ");

  return ` where (${conditions})`;
}

function buildFilterBindings(filter: string | undefined, columns: ColumnMeta[]): string[] {
  if (!filter || columns.length === 0) {
    return [];
  }
  return columns.slice(0, 8).map(() => `%${filter}%`);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function quoteIdent(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(identifier)) {
    throw new Error(`Unsafe identifier: ${identifier}`);
  }
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}
