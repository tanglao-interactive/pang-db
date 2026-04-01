const READ_KEYWORDS = ["select", "with", "explain"];
const WRITE_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "truncate",
  "alter",
  "drop",
  "create",
  "grant",
  "revoke",
  "comment",
  "refresh",
  "merge",
  "vacuum",
  "reindex",
  "call",
  "do",
];

function normalizeSql(sql: string): string {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim()
    .toLowerCase();
}

export function getLeadingKeyword(sql: string): string | null {
  const normalized = normalizeSql(sql);
  if (!normalized) {
    return null;
  }
  const match = normalized.match(/^([a-z]+)/);
  return match?.[1] ?? null;
}

export function isReadOnlySql(sql: string): boolean {
  const keyword = getLeadingKeyword(sql);
  return keyword !== null && READ_KEYWORDS.includes(keyword);
}

export function isWriteSql(sql: string): boolean {
  const keyword = getLeadingKeyword(sql);
  return keyword !== null && WRITE_KEYWORDS.includes(keyword);
}

export function assertQueryAllowed(sql: string, allowWrite = false): void {
  if (!sql.trim()) {
    throw new Error("Query text is required.");
  }

  if (allowWrite) {
    return;
  }

  if (!isReadOnlySql(sql)) {
    throw new Error(
      "Read-only mode only allows SELECT, WITH, and EXPLAIN statements.",
    );
  }
}
