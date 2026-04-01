import { NextRequest, NextResponse } from "next/server";
import { handleQueryRequest, toApiErrorResponse } from "@/lib/api-handlers";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    sql?: string;
    allowWrite?: boolean;
  };

  try {
    const result = await handleQueryRequest({
      sql: body.sql ?? "",
      allowWrite: body.allowWrite ?? false,
    });

    return NextResponse.json(result, {
      status: result.error && !result.rows.length ? 400 : 200,
    });
  } catch (error) {
    const payload = toApiErrorResponse(error);
    return NextResponse.json(payload, { status: 500 });
  }
}
