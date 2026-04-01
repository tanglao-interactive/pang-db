import { handleQueryRequest } from "@/lib/api-handlers";
import * as executor from "@/lib/lambda-executor";

describe("api handlers", () => {
  it("passes query requests to the explorer executor", async () => {
    const spy = vi
      .spyOn(executor, "dispatchExplorerAction")
      .mockResolvedValue({
        columns: ["server_time"],
        rows: [{ server_time: "2026-03-31T00:00:00Z" }],
        rowCount: 1,
        durationMs: 4,
        notices: [],
      });

    const response = await handleQueryRequest({
      sql: "select now() as server_time",
      allowWrite: false,
    });

    expect(spy).toHaveBeenCalledWith({
      type: "query",
      input: {
        sql: "select now() as server_time",
        allowWrite: false,
      },
    });
    expect(response.rowCount).toBe(1);
  });
});
