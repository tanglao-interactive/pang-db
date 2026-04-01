import { NextRequest, NextResponse } from "next/server";
import { handleTableRequest, toApiErrorResponse } from "@/lib/api-handlers";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const schema = searchParams.get("schema");
  const table = searchParams.get("table");

  if (!schema || !table) {
    return NextResponse.json(
      { error: "schema and table are required" },
      { status: 400 },
    );
  }

  try {
    const result = await handleTableRequest({
      schema,
      table,
      page: Number(searchParams.get("page") ?? "0"),
      pageSize: Number(searchParams.get("pageSize") ?? "25"),
      sort: searchParams.get("sort") ?? undefined,
      filter: searchParams.get("filter") ?? undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const payload = toApiErrorResponse(error);
    return NextResponse.json(payload, { status: 500 });
  }
}
