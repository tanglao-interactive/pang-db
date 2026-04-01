import { NextRequest, NextResponse } from "next/server";
import { handleTablesRequest } from "@/lib/api-handlers";

export async function GET(request: NextRequest) {
  const schema = request.nextUrl.searchParams.get("schema");
  if (!schema) {
    return NextResponse.json({ error: "schema is required" }, { status: 400 });
  }

  const result = await handleTablesRequest(schema);
  return NextResponse.json(result);
}
