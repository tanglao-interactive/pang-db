import { NextRequest, NextResponse } from "next/server";
import { handleTablesRequest, toApiErrorResponse } from "@/lib/api-handlers";

export async function GET(request: NextRequest) {
  const schema = request.nextUrl.searchParams.get("schema");
  if (!schema) {
    return NextResponse.json({ error: "schema is required" }, { status: 400 });
  }

  try {
    const result = await handleTablesRequest(schema);
    return NextResponse.json(result);
  } catch (error) {
    const payload = toApiErrorResponse(error);
    return NextResponse.json(payload, { status: 500 });
  }
}
