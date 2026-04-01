"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Typography,
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import TableChartRoundedIcon from "@mui/icons-material/TableChartRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import type {
  ConnectionStatusResponse,
  QueryResponse,
  SchemaItem,
  TableDataResponse,
  TableItem,
} from "@/lib/contracts";

type WorkspaceTab = "browse" | "query";

export function ExplorerApp() {
  const [connection, setConnection] = useState<ConnectionStatusResponse | null>(null);
  const [schemas, setSchemas] = useState<SchemaItem[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableDataResponse | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("browse");
  const [loadingConnection, setLoadingConnection] = useState(true);
  const [loadingTable, setLoadingTable] = useState(false);
  const [queryText, setQueryText] = useState("select now() as server_time;");
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [queryRunning, setQueryRunning] = useState(false);
  const [allowWrite, setAllowWrite] = useState(false);
  const [tableFilter, setTableFilter] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    void loadConnection();
  }, []);

  useEffect(() => {
    if (!selectedSchema) {
      return;
    }
    void loadTables(selectedSchema);
  }, [selectedSchema]);

  useEffect(() => {
    if (!selectedSchema || !selectedTable) {
      return;
    }
    void loadTable(selectedSchema, selectedTable, page, pageSize, tableFilter);
  }, [selectedSchema, selectedTable, page, pageSize, tableFilter]);

  const selectedTableLabel = useMemo(() => {
    if (!selectedSchema || !selectedTable) {
      return "Choose a table";
    }
    return `${selectedSchema}.${selectedTable}`;
  }, [selectedSchema, selectedTable]);

  async function loadConnection() {
    setLoadingConnection(true);
    const [connectionResponse, schemasResponse] = await Promise.all([
      fetch("/api/connection").then((res) => res.json() as Promise<ConnectionStatusResponse>),
      fetch("/api/schemas").then((res) => res.json() as Promise<SchemaItem[]>),
    ]);

    setConnection(connectionResponse);
    setSchemas(schemasResponse);
    const firstSchema = schemasResponse[0]?.name ?? null;
    setSelectedSchema(firstSchema);
    setLoadingConnection(false);
  }

  async function loadTables(schema: string) {
    const response = await fetch(`/api/tables?schema=${encodeURIComponent(schema)}`);
    const items = (await response.json()) as TableItem[];
    setTables(items);
    const firstTable = items[0]?.name ?? null;
    setSelectedTable(firstTable);
    setPage(0);
  }

  async function loadTable(
    schema: string,
    table: string,
    nextPage: number,
    nextPageSize: number,
    filter: string,
  ) {
    setLoadingTable(true);
    const searchParams = new URLSearchParams({
      schema,
      table,
      page: String(nextPage),
      pageSize: String(nextPageSize),
    });
    if (filter.trim()) {
      searchParams.set("filter", filter.trim());
    }

    const response = await fetch(`/api/table?${searchParams.toString()}`);
    const payload = (await response.json()) as TableDataResponse;
    setTableData(payload);
    setLoadingTable(false);
  }

  async function runQuery() {
    setQueryRunning(true);
    const response = await fetch("/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: queryText,
        allowWrite,
      }),
    });
    const payload = (await response.json()) as QueryResponse;
    setQueryResult(payload);
    setTab("query");
    setQueryRunning(false);
  }

  return (
    <Box sx={{ minHeight: "100vh", p: { xs: 2, md: 3 } }}>
      <Stack spacing={2}>
        <Paper
          sx={{
            p: 2.5,
            backdropFilter: "blur(10px)",
            backgroundColor: "rgba(255,255,255,0.8)",
          }}
        >
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", lg: "center" }}
          >
            <Box>
              <Typography variant="h4">Pang DB</Typography>
              <Typography color="text.secondary">
                Lightweight PostgreSQL workbench for Amplify Gen 2 sandbox usage.
              </Typography>
            </Box>

            {loadingConnection ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={18} />
                <Typography>Checking database connection...</Typography>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  color={connection?.connected ? "success" : "warning"}
                  label={connection?.connected ? "Connected" : "Not connected"}
                />
                {connection?.database ? <Chip label={`DB: ${connection.database}`} /> : null}
                {connection?.currentUser ? <Chip label={`User: ${connection.currentUser}`} /> : null}
                <Chip label={`Mode: ${connection?.via ?? "server"}`} />
                {connection?.configSource ? (
                  <Chip label={`Config: ${connection.configSource}`} />
                ) : null}
              </Stack>
            )}
          </Stack>
          {connection?.error ? <Alert sx={{ mt: 2 }} severity="error">{connection.error}</Alert> : null}
        </Paper>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "300px minmax(0, 1fr)" },
            gap: 2,
            alignItems: "start",
          }}
        >
          <Paper sx={{ p: 2, height: "100%" }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <StorageRoundedIcon color="primary" />
                <Typography variant="h6">Explorer</Typography>
              </Stack>
              <Divider />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Schemas
                </Typography>
                <Stack spacing={1}>
                  {schemas && schemas.map((schema) => (
                    <Button
                      key={schema.name}
                      variant={selectedSchema === schema.name ? "contained" : "text"}
                      onClick={() => setSelectedSchema(schema.name)}
                      sx={{ justifyContent: "flex-start" }}
                    >
                      {schema.name}
                    </Button>
                  ))}
                  {!schemas.length && !loadingConnection ? (
                    <Typography color="text.secondary">No visible schemas.</Typography>
                  ) : null}
                </Stack>
              </Box>
              <Divider />
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Tables & views
                </Typography>
                <Stack spacing={1} sx={{ maxHeight: 420, overflow: "auto" }}>
                  {tables.map((table) => (
                    <Button
                      key={`${table.schema}.${table.name}`}
                      variant={selectedTable === table.name ? "contained" : "text"}
                      color={table.type === "view" ? "secondary" : "primary"}
                      onClick={() => {
                        setSelectedTable(table.name);
                        setTab("browse");
                        setPage(0);
                      }}
                      sx={{ justifyContent: "flex-start" }}
                    >
                      {table.name}
                    </Button>
                  ))}
                  {selectedSchema && !tables.length ? (
                    <Typography color="text.secondary">
                      No tables or views in this schema.
                    </Typography>
                  ) : null}
                </Stack>
              </Box>
            </Stack>
          </Paper>

          <Stack spacing={2}>
            <Paper sx={{ p: 1 }}>
              <Tabs value={tab} onChange={(_, value: WorkspaceTab) => setTab(value)}>
                <Tab
                  icon={<TableChartRoundedIcon fontSize="small" />}
                  iconPosition="start"
                  value="browse"
                  label="Browse"
                />
                <Tab
                  icon={<TerminalRoundedIcon fontSize="small" />}
                  iconPosition="start"
                  value="query"
                  label="Query"
                />
              </Tabs>
            </Paper>

            {tab === "browse" ? (
              <Paper sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    spacing={2}
                    alignItems={{ xs: "flex-start", md: "center" }}
                  >
                    <Box>
                      <Typography variant="h6">{selectedTableLabel}</Typography>
                      <Typography color="text.secondary">
                        Paginated live preview with lightweight text filtering.
                      </Typography>
                    </Box>
                    <TextField
                      label="Filter rows"
                      value={tableFilter}
                      onChange={(event) => {
                        setTableFilter(event.target.value);
                        setPage(0);
                      }}
                      size="small"
                    />
                  </Stack>

                  {loadingTable ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={18} />
                      <Typography>Loading table data...</Typography>
                    </Stack>
                  ) : tableData ? (
                    <>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {tableData.columns.map((column) => (
                          <Chip
                            key={column.name}
                            size="small"
                            color={column.isPrimaryKey ? "secondary" : "default"}
                            label={`${column.name}: ${column.dataType}`}
                          />
                        ))}
                      </Stack>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              {tableData.columns.map((column) => (
                                <TableCell key={column.name}>{column.name}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {tableData.rows.map((row, rowIndex) => (
                              <TableRow key={rowIndex}>
                                {tableData.columns.map((column) => (
                                  <TableCell key={column.name}>
                                    {formatCellValue(row[column.name])}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                            {!tableData.rows.length ? (
                              <TableRow>
                                <TableCell colSpan={Math.max(tableData.columns.length, 1)}>
                                  <Typography color="text.secondary">
                                    No rows returned for this page.
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <TablePagination
                        component="div"
                        count={tableData.totalRows}
                        page={page}
                        onPageChange={(_, nextPage) => setPage(nextPage)}
                        rowsPerPage={pageSize}
                        onRowsPerPageChange={(event) => {
                          setPageSize(Number(event.target.value));
                          setPage(0);
                        }}
                        rowsPerPageOptions={[10, 25, 50, 100]}
                      />
                    </>
                  ) : (
                    <Typography color="text.secondary">
                      Select a schema and table to load a preview.
                    </Typography>
                  )}
                </Stack>
              </Paper>
            ) : (
              <Paper sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h6">SQL runner</Typography>
                    <Typography color="text.secondary">
                      Read-only by default. Turn on write mode only when you mean it.
                    </Typography>
                  </Box>
                  <TextField
                    label="SQL"
                    value={queryText}
                    onChange={(event) => setQueryText(event.target.value)}
                    multiline
                    minRows={10}
                    maxRows={18}
                    fullWidth
                  />
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", md: "center" }}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          checked={allowWrite}
                          onChange={(event) => setAllowWrite(event.target.checked)}
                        />
                      }
                      label="Allow write statements for this session"
                    />
                    <Button
                      variant="contained"
                      startIcon={<PlayArrowRoundedIcon />}
                      onClick={() => void runQuery()}
                      disabled={queryRunning}
                    >
                      {queryRunning ? "Running..." : "Run query"}
                    </Button>
                  </Stack>

                  {queryResult?.error ? <Alert severity="error">{queryResult.error}</Alert> : null}

                  {queryResult ? (
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip label={`Rows: ${queryResult.rowCount}`} />
                        <Chip label={`Time: ${queryResult.durationMs}ms`} />
                        <Chip label={allowWrite ? "Write mode on" : "Read-only mode"} />
                      </Stack>

                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              {queryResult.columns.map((column) => (
                                <TableCell key={column}>{column}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {queryResult.rows.map((row, rowIndex) => (
                              <TableRow key={rowIndex}>
                                {queryResult.columns.map((column) => (
                                  <TableCell key={column}>
                                    {formatCellValue(row[column])}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                            {!queryResult.rows.length && !queryResult.error ? (
                              <TableRow>
                                <TableCell colSpan={Math.max(queryResult.columns.length, 1)}>
                                  <Typography color="text.secondary">
                                    Query executed successfully with no row payload.
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Stack>
                  ) : null}
                </Stack>
              </Paper>
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
