import { assertQueryAllowed, getLeadingKeyword, isReadOnlySql, isWriteSql } from "@/lib/sql-guard";

describe("sql-guard", () => {
  it("detects read-only statements", () => {
    expect(isReadOnlySql("select * from users")).toBe(true);
    expect(isReadOnlySql("WITH cte AS (select 1) select * from cte")).toBe(true);
    expect(isReadOnlySql(" explain analyze select 1")).toBe(true);
  });

  it("detects write statements", () => {
    expect(isWriteSql("insert into users(id) values (1)")).toBe(true);
    expect(isWriteSql("update users set name = 'x'")).toBe(true);
    expect(isWriteSql("delete from users")).toBe(true);
  });

  it("rejects write statements when read-only mode is active", () => {
    expect(() => assertQueryAllowed("delete from users", false)).toThrow(
      "Read-only mode only allows SELECT, WITH, and EXPLAIN statements.",
    );
  });

  it("accepts writes when explicitly allowed", () => {
    expect(() => assertQueryAllowed("delete from users", true)).not.toThrow();
  });

  it("extracts the leading keyword after comments", () => {
    expect(getLeadingKeyword("-- comment\nselect 1")).toBe("select");
  });
});
